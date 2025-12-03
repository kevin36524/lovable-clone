import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

async function executeInSandbox(
  sandboxId: string,
  command: string,
  workingDir?: string
) {
  if (!process.env.E2B_API_KEY) {
    console.error("ERROR: E2B_API_KEY must be set");
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;

  try {
    // Connect to the sandbox
    console.log(`Connecting to sandbox: ${sandboxId}`);
    sandbox = await Sandbox.connect(sandboxId);

    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    console.log(`✓ Connected to sandbox`);

    // Working directory is not needed in E2b, but we can use it in the command if specified
    if (workingDir) {
      console.log(`Working directory: ${workingDir}`);
    }

    // Execute command
    console.log(`\nExecuting: ${command}\n`);
    const result = await sandbox.commands.run(
      workingDir ? `cd ${workingDir} && ${command}` : command,
      {
        timeoutMs: 600000, // 10 minutes
        onStdout: (data) => console.log(data),
        onStderr: (data) => console.error(data)
      }
    );

    console.log("=== OUTPUT ===");
    console.log(result.stdout);

    if (result.stderr) {
      console.log("=== STDERR ===");
      console.log(result.stderr);
    }

    if (result.exitCode !== 0) {
      console.log(`\nExit code: ${result.exitCode}`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  } finally {
    if (sandbox) {
      await sandbox.close();
    }
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
