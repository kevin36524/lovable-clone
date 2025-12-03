import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

async function removeSandbox(sandboxId: string) {
  if (!process.env.E2B_API_KEY) {
    console.error("ERROR: E2B_API_KEY must be set");
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;

  try {
    console.log(`Removing sandbox: ${sandboxId}...`);
    sandbox = await Sandbox.connect(sandboxId);

    await sandbox.kill();
    console.log("✓ Sandbox removed successfully");
  } catch (error: any) {
    console.error("Failed to remove sandbox:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const sandboxId = process.argv[2];
  
  if (!sandboxId) {
    console.error("Usage: npx tsx scripts/remove-sandbox.ts <sandbox-id>");
    process.exit(1);
  }

  await removeSandbox(sandboxId);
}

main();