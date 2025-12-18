import { NextRequest } from "next/server";
import { deployTemplateInSandbox } from "@/e2b_utils";

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
    if (gitBranch) {
      console.log("[API] Will switch to git branch:", gitBranch);
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the async deployment
    (async () => {
      try {
        let sandboxId = "";
        let previewUrl = "";

        // Save original console methods for potential restoration
        const originalLog = console.log;
        const originalError = console.error;

        // Create local handler functions scoped to this request
        const handleOutput = (output: string) => {
          // Extract sandbox ID
          const sandboxMatch = output.match(/Sandbox created: ([a-z0-9-]+)/i) ||
                               output.match(/Sandbox ID:\s+([a-z0-9-]+)/i);
          if (sandboxMatch) {
            sandboxId = sandboxMatch[1];
            originalLog("[API] Extracted Sandbox ID:", sandboxId);
          }

          // Extract preview URL - look for Application URL
          const previewMatch = output.match(/Application:\s+(https:\/\/[^\s]+)/i) ||
                              output.match(/Preview URL:\s+(https:\/\/[^\s]+)/i) ||
                              output.match(/(https:\/\/[a-z0-9-]+-3000\..*?\.e2b\.dev)/i);
          if (previewMatch) {
            previewUrl = previewMatch[1];
          }

          // Send as progress, with error handling for closed streams
          try {
            writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "progress",
                message: output
              })}\n\n`)
            );
          } catch (e) {
            // Stream is closed, ignore
          }
        };

        const handleError = (error: string) => {
          // Only send actual errors, not debug info
          if (error.includes("Error") || error.includes("Failed")) {
            try {
              writer.write(
                encoder.encode(`data: ${JSON.stringify({
                  type: "error",
                  message: error
                })}\n\n`)
              );
            } catch (e) {
              // Stream is closed, ignore
            }
          }
        };

        try {
          await deployTemplateInSandbox({
            templateName,
            envVars: {
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
              GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
	      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
	      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
	      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
              NODE_ENV: 'development',
            },
            waitTimeout: 60000,
            healthCheckRetries: 20,
            gitBranch,
            onLog: (...args: any[]) => {
              originalLog(...args);
              handleOutput(args.join(" "));
            },
            onError: (...args: any[]) => {
              originalError(...args);
              handleError(args.join(" "));
            }
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
        } catch (deployError: any) {
          throw deployError;
        }
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
