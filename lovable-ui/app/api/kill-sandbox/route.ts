import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { sandboxId } = await req.json();

    if (!sandboxId) {
      return new Response(
        JSON.stringify({ error: "Sandbox ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.E2B_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing E2B_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[API] Killing sandbox:", sandboxId);

    // Use the remove-sandbox.ts script
    const scriptPath = path.join(process.cwd(), "scripts", "remove-sandbox.ts");

    return new Promise((resolve) => {
      const child = spawn("npx", ["tsx", scriptPath, sandboxId], {
        env: {
          ...process.env,
          E2B_API_KEY: process.env.E2B_API_KEY,
        },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        console.log("[Kill Sandbox]:", data.toString());
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        console.error("[Kill Sandbox Error]:", data.toString());
      });

      child.on("exit", (code) => {
        if (code === 0) {
          console.log("[API] Sandbox killed successfully:", sandboxId);
          resolve(
            new Response(
              JSON.stringify({ success: true, message: "Sandbox killed successfully" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } else {
          console.error("[API] Failed to kill sandbox. Exit code:", code);
          resolve(
            new Response(
              JSON.stringify({ error: stderr || "Failed to kill sandbox" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      });

      child.on("error", (err) => {
        console.error("[API] Error spawning kill process:", err);
        resolve(
          new Response(
            JSON.stringify({ error: err.message || "Failed to kill sandbox" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          )
        );
      });
    });
  } catch (error: any) {
    console.error("[API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
