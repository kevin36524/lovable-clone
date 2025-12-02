import { Daytona } from "@daytonaio/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function executeInSandbox(
  sandboxId: string,
  command: string,
  workingDir?: string
) {
  if (!process.env.DAYTONA_API_KEY) {
    console.error("ERROR: DAYTONA_API_KEY must be set");
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
  });

  try {
    // Get the sandbox
    console.log(`Connecting to sandbox: ${sandboxId}`);
    const sandboxes = await daytona.list();
    const sandbox = sandboxes.find((s: any) => s.id === sandboxId);

    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    console.log(`✓ Connected to sandbox`);

    // Get root directory if not specified
    const rootDir = workingDir || (await sandbox.getUserRootDir());
    console.log(`Working directory: ${rootDir}`);

    // Execute command
    console.log(`\nExecuting: ${command}\n`);
    const result = await sandbox.process.executeCommand(
      command,
      rootDir,
      undefined,
      600000 // 10 minute timeout
    );

    console.log("=== OUTPUT ===");
    console.log(result.result);

    if (result.exitCode !== 0) {
      console.log(`\nExit code: ${result.exitCode}`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: npx tsx scripts/execute-in-sandbox.ts <sandbox-id> <command> [working-dir]"
    );
    console.error("");
    console.error("Examples:");
    console.error(
      "  npx tsx scripts/execute-in-sandbox.ts abc123 'ls -la' /root/website-project"
    );
    console.error("  npx tsx scripts/execute-in-sandbox.ts abc123 'npm run dev'");
    process.exit(1);
  }

  const sandboxId = args[0];
  const command = args[1];
  const workingDir = args[2];

  await executeInSandbox(sandboxId, command, workingDir);
}

main();
