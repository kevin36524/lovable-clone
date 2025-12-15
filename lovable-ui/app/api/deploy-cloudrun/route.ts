import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { runningProcesses } from "@/lib/process-tracker";
import {
  sanitizeServiceName,
  validateBranchName,
  buildEnvVarObject,
  buildFromGitHub,
  deployToCloudRunSDK,
} from "@/lib/cloudrun-deploy";

// Helper to safely write to stream
async function safeWrite(writer: WritableStreamDefaultWriter, encoder: TextEncoder, data: any): Promise<boolean> {
  try {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    return true;
  } catch (error) {
    console.error("[CloudRun API] Write failed, client disconnected");
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { branchName } = await req.json();

    // Validate request
    if (!branchName) {
      return new Response(
        JSON.stringify({ error: "Branch name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate branch name format
    if (!validateBranchName(branchName)) {
      return new Response(
        JSON.stringify({ error: "Invalid branch name format. Only alphanumeric, hyphens, slashes, and underscores are allowed." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate unique request ID
    const requestId = randomUUID();

    console.log("[CloudRun API] Starting deployment for branch:", branchName);
    console.log("[CloudRun API] Request ID:", requestId);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start async deployment (don't await here)
    (async () => {
      try {
        // Send request ID
        const canWrite = await safeWrite(writer, encoder, {
          type: "request_id",
          requestId
        });

        if (!canWrite) {
          console.error("[CloudRun API] Client disconnected before deployment started");
          return;
        }

        // Sanitize service name
        const serviceName = sanitizeServiceName(branchName);
        await safeWrite(writer, encoder, {
          type: "progress",
          message: `Starting deployment: branch=${branchName}, service=${serviceName}`
        });

        // Build environment variable object
        await safeWrite(writer, encoder, {
          type: "progress",
          message: "Building environment variables..."
        });

        let envVars: Record<string, string>;
        try {
          envVars = buildEnvVarObject();
          await safeWrite(writer, encoder, {
            type: "progress",
            message: `Environment variables configured (${Object.keys(envVars).length} vars)`
          });
        } catch (error: any) {
          throw new Error(`Failed to build environment variables: ${error.message}`);
        }

        // Build image from GitHub using Cloud Build
        await safeWrite(writer, encoder, {
          type: "progress",
          message: `Building Docker image from GitHub branch: ${branchName}...`
        });

        await safeWrite(writer, encoder, {
          type: "progress",
          message: "This may take 5-10 minutes for the first build..."
        });

        const imageUri = await buildFromGitHub(
          branchName,
          (message) => {
            safeWrite(writer, encoder, {
              type: "progress",
              message: `[Cloud Build] ${message}`
            });
          }
        );

        await safeWrite(writer, encoder, {
          type: "progress",
          message: `Image built successfully: ${imageUri}`
        });

        // Deploy to Cloud Run
        await safeWrite(writer, encoder, {
          type: "progress",
          message: `Deploying image to Cloud Run...`
        });

        const { serviceUrl } = await deployToCloudRunSDK(
          serviceName,
          imageUri,
          envVars,
          (message) => {
            safeWrite(writer, encoder, {
              type: "progress",
              message: `[Cloud Run] ${message}`
            });
          }
        );

        await safeWrite(writer, encoder, {
          type: "progress",
          message: "Deployment completed successfully!"
        });

        // Send completion message with service URL
        await safeWrite(writer, encoder, {
          type: "complete",
          serviceUrl,
          serviceName
        });

        console.log(`[CloudRun API] Deployment complete: ${serviceUrl}`);

        // Send done signal
        try {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("[CloudRun API] Failed to send DONE signal");
        }

      } catch (error: any) {
        console.error("[CloudRun API] Deployment error:", error);

        await safeWrite(writer, encoder, {
          type: "error",
          message: error.message || "Deployment failed"
        });

        try {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("[CloudRun API] Failed to send DONE signal on error");
        }
      } finally {
        // Remove from process tracking
        runningProcesses.delete(requestId);

        try {
          await writer.close();
        } catch (e) {
          console.error("[CloudRun API] Writer already closed");
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
    console.error("[CloudRun API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
