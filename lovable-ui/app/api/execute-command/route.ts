import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { randomUUID } from "crypto";
import { runningProcesses } from "@/lib/process-tracker";

// Helper to safely write to stream
async function safeWrite(writer: WritableStreamDefaultWriter, encoder: TextEncoder, data: any): Promise<boolean> {
  try {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    return true;
  } catch (error) {
    console.error("[API] Write failed, client disconnected");
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sandboxId, commandType, query } = await req.json();

    if (!sandboxId || !commandType || !query) {
      return new Response(
        JSON.stringify({ error: "Sandbox ID, command type, and query are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (commandType !== "shell" && commandType !== "ai") {
      return new Response(
        JSON.stringify({ error: "Command type must be 'shell' or 'ai'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.E2B_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing API keys" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate unique request ID for this execution
    const requestId = randomUUID();

    console.log("[API] Executing command in sandbox:", sandboxId);
    console.log("[API] Command type:", commandType);
    console.log("[API] Query:", query);
    console.log("[API] Request ID:", requestId);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the async execution (don't await here, let it run in background)
    (async () => {
      // Send request ID as first message
      const canWrite = await safeWrite(writer, encoder, {
        type: "request_id",
        requestId
      });

      if (!canWrite) {
        console.error("[API] Client disconnected before execution started");
        return;
      }

      console.log("[API] Starting execution...");

      try {
        // Use the execute-in-sandbox.ts script
        const scriptPath = path.join(process.cwd(), "scripts", "execute-in-sandbox.ts");

        console.log("[API] Script path:", scriptPath);

        // Prepare command based on type
        let command: string;
        if (commandType === "ai") {
          // For AI commands, use npm run feature with the user query
          command = `pnpx tsx scripts/feature-assistant.ts -- "${query}"`;
          console.log("[API] AI command:", command);
        } else {
          // For shell commands, use the query directly
          command = query;
          console.log("[API] Shell command:", command);
        }

        // Pass sandbox ID, command, and working directory as arguments
        const workingDir = "/home/user/app";
        console.log("[API] Spawning process...");
        const child = spawn("npx", ["tsx", scriptPath, sandboxId, command, workingDir], {
          env: {
            ...process.env,
            E2B_API_KEY: process.env.E2B_API_KEY,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          },
        });

        // Track this process for potential cancellation
        runningProcesses.set(requestId, child);
        console.log("[API] Process spawned, PID:", child.pid);
        console.log("[API] Tracking request:", requestId);
        console.log("[API] Total tracked processes:", runningProcesses.size);

        let buffer = "";

        // Capture stdout
        child.stdout.on("data", async (data) => {
          console.log("[API] Received stdout data");
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            // Parse Claude messages
            if (line.includes('__CLAUDE_MESSAGE__')) {
              const jsonStart = line.indexOf('__CLAUDE_MESSAGE__') + '__CLAUDE_MESSAGE__'.length;
              try {
                const message = JSON.parse(line.substring(jsonStart).trim());
                await safeWrite(writer, encoder, {
                  type: "claude_message",
                  content: message.content
                });
              } catch (e) {
                // Ignore parse errors
              }
            }
            // Parse tool uses
            else if (line.includes('__TOOL_USE__')) {
              const jsonStart = line.indexOf('__TOOL_USE__') + '__TOOL_USE__'.length;
              try {
                const toolUse = JSON.parse(line.substring(jsonStart).trim());
                await safeWrite(writer, encoder, {
                  type: "tool_use",
                  name: toolUse.name,
                  input: toolUse.input
                });
              } catch (e) {
                // Ignore parse errors
              }
            }
            // Parse tool results
            else if (line.includes('__TOOL_RESULT__')) {
              // Skip tool results for now to reduce noise
              continue;
            }
            // Regular progress messages
            else {
              const output = line.trim();

              // Filter out internal logs
              if (output &&
                  !output.includes('[Claude]:') &&
                  !output.includes('[Tool]:') &&
                  !output.includes('__')) {

                // Send as progress
                await safeWrite(writer, encoder, {
                  type: "progress",
                  message: output
                });
              }
            }
          }
        });

        // Capture stderr
        child.stderr.on("data", async (data) => {
          const error = data.toString();
          console.error("[API] Received stderr data");
          console.error("[Execute Error]:", error);

          // Only send actual errors, not debug info
          if (error.includes("Error") || error.includes("Failed")) {
            await safeWrite(writer, encoder, {
              type: "error",
              message: error.trim()
            });
          }
        });

        // Wait for process to complete or timeout after 5 minutes
        const timeout = setTimeout(() => {
          child.kill();
        }, 300000); // 5 minutes

        await new Promise((resolve, reject) => {
          child.on("exit", (code) => {
            clearTimeout(timeout);
            // Remove from tracking when process exits
            runningProcesses.delete(requestId);

            if (code === 0 || code === null) {
              resolve(code);
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });

          child.on("error", (err) => {
            clearTimeout(timeout);
            // Remove from tracking on error
            runningProcesses.delete(requestId);
            reject(err);
          });
        });

        // Send completion
        await safeWrite(writer, encoder, {
          type: "complete"
        });

        console.log(`[API] Query execution complete`);

        // Send done signal
        try {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("[API] Failed to send DONE signal");
        }
      } catch (error: any) {
        console.error("[API] Error during execution:", error);
        await safeWrite(writer, encoder, {
          type: "error",
          message: error.message
        });
        try {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("[API] Failed to send DONE signal on error");
        }
      } finally {
        try {
          await writer.close();
        } catch (e) {
          console.error("[API] Writer already closed");
        }
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("[API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
