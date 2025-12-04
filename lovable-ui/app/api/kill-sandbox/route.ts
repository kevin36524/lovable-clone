import { NextRequest } from "next/server";
import { removeSandbox } from "@/e2b_utils";

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

    try {
      await removeSandbox(sandboxId);
      console.log("[API] Sandbox killed successfully:", sandboxId);
      return new Response(
        JSON.stringify({ success: true, message: "Sandbox killed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("[API] Failed to kill sandbox:", error.message);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to kill sandbox" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
