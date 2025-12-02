import { Daytona } from "@daytonaio/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function generateWebsiteInDaytona(
  sandboxIdArg?: string,
  prompt?: string
) {
  console.log("🚀 Starting website generation in Daytona sandbox...\n");

  if (!process.env.DAYTONA_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: DAYTONA_API_KEY and ANTHROPIC_API_KEY must be set");
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
  });

  let sandbox;
  let sandboxId = sandboxIdArg;

  try {
    // Step 1: Create or get volume
    console.log("1. Setting up shared volume...");
    const volume = await daytona.volume.get("hack-volume", { create: true });
    console.log(`✓ Volume ready: ${volume.id}`);

    // Step 2: Create or get sandbox
    if (sandboxId) {
      console.log(`2. Using existing sandbox: ${sandboxId}`);
      // Get existing sandbox
      const sandboxes = await daytona.list();
      sandbox = sandboxes.find((s: any) => s.id === sandboxId);
      if (!sandbox) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }
      console.log(`✓ Connected to sandbox: ${sandbox.id}`);
    } else {
      console.log("2. Creating new Daytona sandbox...");
      sandbox = await daytona.create({
        public: true,
        image: "node:latest",
        volumes: [
          {
            volumeId: volume.id,
            mountPath: "/hack-volume"
          }
        ],
        resources: {
          memory: 2, // 2GB memory
          disk: 8 // 8GB disk
        },
        autoDeleteInterval: 120
      });
      sandboxId = sandbox.id;
      console.log(`✓ Sandbox created: ${sandboxId}`);
    }

    // Get the root directory
    const rootDir = await sandbox.getUserRootDir();
    console.log(`✓ Working directory: ${rootDir}`);

    // Step 3: Clone hack-skeleton-app
    console.log("\n3. Cloning hack-skeleton-app...");
    const cloneResult = await sandbox.process.executeCommand(
      "cp -r /hack-volume/website-project.tgz . ; tar -xzf website-project.tgz ; rm website-project.tgz",
      rootDir,
      undefined,
      60000 // 1 minute timeout
    );

    const projectDir = `${rootDir}/website-project`;
    
    // Step 4: Set up .env file
    console.log("\n4. Setting up .env file...");
    const envContent = `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`;
    await sandbox.process.executeCommand(
      `cat > .env << 'EOF'
${envContent}
EOF`,
      projectDir
    );
    console.log("✓ .env file created");

    // Step 5: Check generated files
    console.log("\n5. Checking project files...");
    const filesResult = await sandbox.process.executeCommand(
      "ls -la",
      projectDir
    );
    console.log(filesResult.result);

    // Step 6: Start dev server in background
    console.log("\n6. Starting development server in background...");
      // Start the server in background using nohup
      await sandbox.process.executeCommand(
        `nohup npm run dev > dev-server.log 2>&1 &`,
        projectDir,
        { PORT: "3000" }
      );

    console.log("✓ Server started in background");

    // Wait a bit for server to initialize
    console.log("\n7. Waiting for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Check if server is running
    const checkServer = await sandbox.process.executeCommand(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'failed'",
      projectDir
    );

    if (checkServer.result?.trim() === '200') {
      console.log("✓ Server is running!");
    } else {
      console.log("⚠️  Server might still be starting...");
      console.log("You can check logs with: cat dev-server.log");
    }

    // Step 8: Get preview URL
    console.log("\n8. Getting preview URL...");
    const preview = await sandbox.getPreviewLink(3000);

    console.log("\n✨ SUCCESS! Website generated!");
    console.log("\n📊 SUMMARY:");
    console.log("===========");
    console.log(`Sandbox ID: ${sandboxId}`);
    console.log(`Project Directory: ${projectDir}`);
    console.log(`Preview URL: ${preview.url}`);
    if (preview.token) {
      console.log(`Access Token: ${preview.token}`);
    }

    console.log("\n🌐 VISIT YOUR WEBSITE:");
    console.log(preview.url);

    console.log("\n💡 TIPS:");
    console.log("- The sandbox will stay active for debugging");
    console.log("- Server logs: SSH in and run 'cat website-project/dev-server.log'");
    console.log(
      `- To get preview URL again: npx tsx scripts/get-preview-url.ts ${sandboxId}`
    );
    console.log(
      `- To reuse this sandbox: npx tsx scripts/generate-in-daytona.ts ${sandboxId}`
    );
    console.log(`- To remove: npx tsx scripts/remove-sandbox.ts ${sandboxId}`);

    return {
      success: true,
      sandboxId: sandboxId,
      projectDir: projectDir,
      previewUrl: preview.url,
    };
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);

    if (sandbox) {
      console.log(`\nSandbox ID: ${sandboxId}`);
      console.log("The sandbox is still running for debugging.");

      // Try to get debug info
      try {
        const debugInfo = await sandbox.process.executeCommand(
          "pwd && echo '---' && ls -la && echo '---' && test -f generate.js && cat generate.js | head -20 || echo 'No script'",
          `${await sandbox.getUserRootDir()}/website-project`
        );
        console.log("\nDebug info:");
        console.log(debugInfo.result);
      } catch (e) {
        // Ignore
      }
    }

    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let sandboxId: string | undefined;
  let prompt: string | undefined;

  // Parse arguments
  if (args.length > 0) {
    // Check if first arg is a sandbox ID (UUID format)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(args[0])) {
      sandboxId = args[0];
      prompt = args.slice(1).join(" ");
    } else {
      prompt = args.join(" ");
    }
  }

  if (!prompt) {
    prompt =
      "Create a modern blog website with markdown support and a dark theme. Include a home page, blog listing page, and individual blog post pages.";
  }

  console.log("📝 Configuration:");
  console.log(
    `- Sandbox: ${sandboxId ? `Using existing ${sandboxId}` : "Creating new"}`
  );
  console.log(`- Prompt: ${prompt}`);
  console.log();

  try {
    await generateWebsiteInDaytona(sandboxId, prompt);
  } catch (error) {
    console.error("Failed to generate website:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Exiting... The sandbox will continue running.");
  process.exit(0);
});

main();
