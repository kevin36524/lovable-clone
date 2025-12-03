import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function generateWebsiteInE2b(
  sandboxIdArg?: string,
  prompt?: string
) {
  console.log("🚀 Starting website generation in E2b sandbox...\n");

  if (!process.env.E2B_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: E2B_API_KEY and ANTHROPIC_API_KEY must be set");
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;
  let sandboxId = sandboxIdArg;

  try {
    // Step 1: Create or connect to sandbox
    if (sandboxId) {
      console.log(`1. Connecting to existing sandbox: ${sandboxId}`);
      try {
        sandbox = await Sandbox.connect(sandboxId);
        console.log(`✓ Connected to sandbox: ${sandbox.sandboxId}`);
      } catch (err) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }
    } else {
      console.log("1. Creating new E2b sandbox...");
      sandbox = await Sandbox.create();
      sandboxId = sandbox.sandboxId;
      console.log(`✓ Sandbox created: ${sandboxId}`);
    }

    // Step 2: Extract project files
    console.log("\n2. Extracting project files...");
    const extractResult = await sandbox.commands.exec(
      "cp -r /hack-volume/website-project.tgz . ; tar -xzf website-project.tgz ; rm website-project.tgz"
    );

    if (extractResult.exitCode !== 0) {
      console.error("Extraction error:", extractResult.stderr);
    }

    const projectDir = `website-project`;

    // Step 3: Set up .env file
    console.log("\n3. Setting up .env file...");
    const envContent = `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`;
    await sandbox.commands.exec(
      `cat > .env << 'EOF'
${envContent}
EOF`
    );
    console.log("✓ .env file created");

    // Step 4: Check generated files
    console.log("\n4. Checking project files...");
    const filesResult = await sandbox.commands.exec("ls -la");
    console.log(filesResult.stdout);

    // Step 5: Start dev server in background
    console.log("\n5. Starting development server in background...");
    // Start the server in background using nohup
    await sandbox.commands.exec(
      `nohup npm run dev > dev-server.log 2>&1 &`
    );

    console.log("✓ Server started in background");

    // Wait a bit for server to initialize
    console.log("\n6. Waiting for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Check if server is running
    const checkServer = await sandbox.commands.exec(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'failed'"
    );

    if (checkServer.stdout?.trim() === '200') {
      console.log("✓ Server is running!");
    } else {
      console.log("⚠️  Server might still be starting...");
      console.log("You can check logs with: cat dev-server.log");
    }

    // Step 7: Get preview URL
    console.log("\n7. Getting preview URL...");
    const previewUrl = sandbox.getHost(3000);

    console.log("\n✨ SUCCESS! Website generated!");
    console.log("\n📊 SUMMARY:");
    console.log("===========");
    console.log(`Sandbox ID: ${sandboxId}`);
    console.log(`Project Directory: ${projectDir}`);
    console.log(`Preview URL: ${previewUrl}`);

    console.log("\n🌐 VISIT YOUR WEBSITE:");
    console.log(previewUrl);

    console.log("\n💡 TIPS:");
    console.log("- The sandbox will stay active for debugging");
    console.log("- Server logs: Run 'cat website-project/dev-server.log'");
    console.log(
      `- To get preview URL again: npx tsx scripts/get-preview-url.ts ${sandboxId}`
    );
    console.log(
      `- To reuse this sandbox: npx tsx scripts/generate-in-daytona.ts ${sandboxId}`
    );
    console.log(`- To remove: npx tsx scripts/remove-sandbox.ts ${sandboxId}`);

    if (sandbox) {
      await sandbox.close();
    }

    return {
      success: true,
      sandboxId: sandboxId,
      projectDir: projectDir,
      previewUrl: previewUrl,
    };
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);

    if (sandbox) {
      console.log(`\nSandbox ID: ${sandboxId}`);
      console.log("The sandbox is still running for debugging.");

      // Try to get debug info
      try {
        const debugInfo = await sandbox.commands.exec({
          command: "pwd && echo '---' && ls -la && echo '---' && test -f generate.js && cat generate.js | head -20 || echo 'No script'",
          timeout: 10,
        });
        console.log("\nDebug info:");
        console.log(debugInfo.stdout);
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
    // Check if first arg is a sandbox ID (UUID-like format)
    const uuidRegex =
      /^[a-z0-9-]{20,}$/i;
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
    await generateWebsiteInE2b(sandboxId, prompt);
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
