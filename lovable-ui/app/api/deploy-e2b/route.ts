import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { templateName, gitBranch } = await req.json();

    if (!templateName) {
      return new Response(
        JSON.stringify({ error: "Template name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.E2B_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing API keys" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[API] Starting E2B deployment for template:", templateName);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the async deployment
    (async () => {
      try {
        // Use the deploy-e2b-template.ts script
        const scriptPath = path.join(process.cwd(), "scripts", "deploy-e2b-template.ts");

        // Pass template info as environment variables
        const child = spawn("npx", ["tsx", scriptPath], {
          env: {
            ...process.env,
            E2B_API_KEY: process.env.E2B_API_KEY,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            TEMPLATE_NAME: templateName,
            GIT_BRANCH: gitBranch || "",
          },
        });

        let sandboxId = "";
        let previewUrl = "";
        let buffer = "";

        // Capture stdout
        child.stdout.on("data", async (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            const output = line.trim();

            // Send as progress
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "progress",
                message: output
              })}\n\n`)
            );

            // Extract sandbox ID
            const sandboxMatch = output.match(/Sandbox created: ([a-z0-9-]+)/i) ||
                                 output.match(/Sandbox ID:\s+([a-z0-9-]+)/i);
            if (sandboxMatch) {
              sandboxId = sandboxMatch[1];
              console.log("[API] Extracted Sandbox ID:", sandboxId);
            }

            // Extract preview URL - look for Application URL
            const previewMatch = output.match(/Application:\s+(https:\/\/[^\s]+)/i) ||
                                output.match(/Preview URL:\s+(https:\/\/[^\s]+)/i) ||
                                output.match(/(https:\/\/[a-z0-9-]+-3000\..*?\.e2b\.dev)/i);
            if (previewMatch) {
              previewUrl = previewMatch[1];
              console.log("[API] Extracted Preview URL:", previewUrl);
            }
          }
        });

        // Capture stderr
        child.stderr.on("data", async (data) => {
          const error = data.toString();
          console.error("[E2B Error]:", error);

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

        // Wait for process to complete or timeout after 10 minutes
        const timeout = setTimeout(() => {
          child.kill();
        }, 600000); // 10 minutes

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

        // Send completion with preview URL
        if (previewUrl && sandboxId) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({
              type: "complete",
              sandboxId,
              previewUrl
            })}\n\n`)
          );
          console.log(`[API] Deployment complete. Sandbox: ${sandboxId}, Preview URL: ${previewUrl}`);
        } else {
          throw new Error(`Failed to get preview URL or sandbox ID. URL: ${previewUrl}, ID: ${sandboxId}`);
        }

        // Send done signal
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (error: any) {
        console.error("[API] Error during deployment:", error);
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
