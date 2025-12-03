import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getPreviewUrl(sandboxId: string, port: number = 3000) {
  if (!process.env.E2B_API_KEY) {
    console.error("ERROR: E2B_API_KEY must be set");
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;

  try {
    // Connect to sandbox
    sandbox = await Sandbox.connect(sandboxId);

    console.log(`✓ Found sandbox: ${sandboxId}`);

    // Get preview URL
    const previewUrl = sandbox.getHost(port);

    console.log("\n🌐 Preview URL:");
    console.log(previewUrl);

    return previewUrl;
  } catch (error: any) {
    console.error("Failed to get preview URL:", error.message);
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
  const port = process.argv[3] ? parseInt(process.argv[3]) : 3000;
  
  if (!sandboxId) {
    console.error("Usage: npx tsx scripts/get-preview-url.ts <sandbox-id> [port]");
    console.error("Example: npx tsx scripts/get-preview-url.ts 7a517a82-942c-486b-8a62-6357773eb3ea 3000");
    process.exit(1);
  }

  await getPreviewUrl(sandboxId, port);
}

main();