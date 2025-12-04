import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

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

    console.log("[API] Executing command in sandbox:", sandboxId);
    console.log("[API] Command type:", commandType);
    console.log("[API] Query:", query);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the async execution
    (async () => {
      try {
        // Use the execute-in-sandbox.ts script
        const scriptPath = path.join(process.cwd(), "scripts", "execute-in-sandbox.ts");

        // Prepare command based on type
        let command: string;
        if (commandType === "ai") {
          // For AI commands, use npm run feature with the user query
          command = `npm run feature -- "${query}"`;
        } else {
          // For shell commands, use the query directly
          command = query;
        }

        // Pass sandbox ID, command, and working directory as arguments
        const workingDir = "/home/user/app";
        const child = spawn("npx", ["tsx", scriptPath, sandboxId, command, workingDir], {
          env: {
            ...process.env,
            E2B_API_KEY: process.env.E2B_API_KEY,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          },
        });

        let buffer = "";

        // Capture stdout
        child.stdout.on("data", async (data) => {
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
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "claude_message",
                    content: message.content
                  })}\n\n`)
                );
              } catch (e) {
                // Ignore parse errors
              }
            }
            // Parse tool uses
            else if (line.includes('__TOOL_USE__')) {
              const jsonStart = line.indexOf('__TOOL_USE__') + '__TOOL_USE__'.length;
              try {
                const toolUse = JSON.parse(line.substring(jsonStart).trim());
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "tool_use",
                    name: toolUse.name,
                    input: toolUse.input
                  })}\n\n`)
                );
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
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "progress",
                    message: output
                  })}\n\n`)
                );
              }
            }
          }
        });

        // Capture stderr
        child.stderr.on("data", async (data) => {
          const error = data.toString();
          console.error("[Execute Error]:", error);

          // Only send actual errors, not debug info
          if (error.includes("Error") || error.includes("Failed")) {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "error",
                message: error.trim()
              })}\n\n`)
            );
          }
        });

        // Wait for process to complete or timeout after 5 minutes
        const timeout = setTimeout(() => {
          child.kill();
        }, 300000); // 5 minutes

        await new Promise((resolve, reject) => {
          child.on("exit", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
              resolve(code);
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });

          child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        // Send completion
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: "complete"
          })}\n\n`)
        );

        console.log(`[API] Query execution complete`);

        // Send done signal
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (error: any) {
        console.error("[API] Error during execution:", error);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: "error",
            message: error.message
          })}\n\n`)
        );
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } finally {
        await writer.close();
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
