import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

async function startDevServer(sandboxId: string, projectPath: string = "website-project") {
  if (!process.env.E2B_API_KEY) {
    console.error("ERROR: E2B_API_KEY must be set");
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;

  try {
    // Connect to sandbox
    console.log(`Connecting to sandbox: ${sandboxId}`);
    sandbox = await Sandbox.connect(sandboxId);

    console.log(`✓ Found sandbox: ${sandboxId}`);

    // Check if project exists
    const checkProject = await sandbox.commands.exec(
      `test -d ${projectPath} && echo "exists" || echo "not found"`
    );

    if (checkProject.stdout?.trim() !== "exists") {
      throw new Error(`Project directory ${projectPath} not found in sandbox`);
    }

    // Kill any existing dev server
    console.log("Stopping any existing dev server...");
    await sandbox.commands.exec(
      `cd ${projectPath} && pkill -f 'npm run dev' || true`
    );

    // Start dev server in background
    console.log("Starting development server...");
    await sandbox.commands.exec(
      `cd ${projectPath} && nohup npm run dev > dev-server.log 2>&1 &`
    );

    console.log("✓ Server started in background");

    // Wait for server to start
    console.log("Waiting for server to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Check if server is running
    const checkServer = await sandbox.commands.exec(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'failed'"
    );

    if (checkServer.stdout?.trim() === '200') {
      console.log("✓ Server is running!");

      // Get preview URL
      const previewUrl = sandbox.getHost(3000);
      console.log("\n🌐 Preview URL:");
      console.log(previewUrl);
    } else {
      console.log("⚠️  Server might still be starting...");
      console.log("Check logs by running:");
      console.log(`cat ${projectPath}/dev-server.log`);
    }

  } catch (error: any) {
    console.error("Failed to start dev server:", error.message);
    process.exit(1);
  } finally {
    if (sandbox) {
      await sandbox.close();
    }
  }
}

// Main execution
async function main() {
  const sandboxId = process.argv[2];
  const projectPath = process.argv[3] || "website-project";
  
  if (!sandboxId) {
    console.error("Usage: npx tsx scripts/start-dev-server.ts <sandbox-id> [project-path]");
    console.error("Example: npx tsx scripts/start-dev-server.ts 7a517a82-942c-486b-8a62-6357773eb3ea");
    process.exit(1);
  }

  await startDevServer(sandboxId, projectPath);
}

main();