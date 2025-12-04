import { NextRequest } from "next/server";
import { runningProcesses } from "@/lib/process-tracker";

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[API] Cancelling execution:", requestId);
    console.log("[API] Currently tracked processes:", Array.from(runningProcesses.keys()));

    const process = runningProcesses.get(requestId);
    if (process) {
      console.log("[API] Found process with PID:", process.pid);

      // Kill the child process and its children
      // Use negative PID to kill the entire process group
      try {
        if (process.pid) {
          // Kill the process group
          process.kill("SIGTERM");

          // Force kill after 1 second if still running
          setTimeout(() => {
            try {
              process.kill("SIGKILL");
            } catch (e) {
              // Process already dead
            }
          }, 1000);
        }
      } catch (killError: any) {
        console.error("[API] Error killing process:", killError.message);
      }

      // Remove from tracking
      runningProcesses.delete(requestId);

      console.log("[API] Process killed:", requestId);

      return new Response(
        JSON.stringify({ success: true, message: "Execution cancelled" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Process not found or already completed" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[API] Error cancelling execution:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
