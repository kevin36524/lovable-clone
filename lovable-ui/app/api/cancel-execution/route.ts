import { NextRequest } from "next/server";
import { runningProcesses, isE2BProcess } from "@/lib/process-tracker";

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
      try {
        if (isE2BProcess(process)) {
          // E2B process - use its kill method
          console.log("[API] Found E2B process, killing...");
          await process.kill("SIGTERM");
          console.log("[API] E2B process killed:", requestId);
        } else {
          // Child process - use PID
          console.log("[API] Found child process with PID:", process.pid);
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
          console.log("[API] Child process killed:", requestId);
        }
      } catch (killError: any) {
        console.error("[API] Error killing process:", killError.message);
      }

      // Remove from tracking
      runningProcesses.delete(requestId);

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
