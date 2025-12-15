import { NextRequest } from "next/server";
import { spawn } from "child_process";

export async function GET(req: NextRequest) {
  try {
    // Test 1: Check if gcloud exists using 'which'
    const whichResult = await new Promise<string>((resolve, reject) => {
      const proc = spawn("which", ["gcloud"]);
      let output = "";
      let error = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        error += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`which gcloud failed: ${error || "not found"}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });

    // Test 2: Try to run gcloud version
    const versionResult = await new Promise<string>((resolve, reject) => {
      const proc = spawn("gcloud", ["version"]);
      let output = "";
      let error = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        error += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`gcloud version failed with code ${code}: ${error}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });

    // Test 3: Check PATH
    const pathEnv = process.env.PATH || "";

    return new Response(
      JSON.stringify({
        success: true,
        gcloudPath: whichResult,
        gcloudVersion: versionResult,
        PATH: pathEnv,
        user: process.env.USER || "unknown",
        uid: process.getuid ? process.getuid() : "unknown",
      }, null, 2),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        PATH: process.env.PATH || "",
        user: process.env.USER || "unknown",
        uid: process.getuid ? process.getuid() : "unknown",
      }, null, 2),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
