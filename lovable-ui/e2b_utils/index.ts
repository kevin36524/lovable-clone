import { Sandbox } from '@e2b/code-interpreter';
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

interface DeploymentConfig {
  templateName: string;
  envVars?: Record<string, string>;
  waitTimeout?: number;
  healthCheckRetries?: number;
}

interface DeploymentResult {
  sandbox: Sandbox;
  sandboxId: string;
  url: string;
  getLogs: () => Promise<{ devLogs: string }>;
  extendTimeout: (hours?: number) => Promise<void>;
}

/**
 * Deploy a template in a sandbox and wait for services to be ready
 */
export async function deployTemplateInSandbox(config: DeploymentConfig): Promise<DeploymentResult> {
  const {
    templateName,
    envVars = {},
    waitTimeout = 60000,
    healthCheckRetries = 15
  } = config

  console.log('🚀 Starting deployment...')
  console.log('📝 Template Name:', templateName)

  const sandbox = await Sandbox.create(templateName, {
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 600_000 // 10 minutes
  })

  try {
    console.log('✅ Sandbox created:', sandbox.sandboxId)

    // Create template from E2B template
    console.log('\n📦 Creating environment from template...')

    // E2B templates are instantiated via the Sandbox API
    // The template deployment happens during sandbox creation with template specification
    const initResult = await sandbox.commands.run(
      `echo "Template ${templateName} is being used for this sandbox"`,
      {
        onStdout: (data) => { process.stdout.write(data); },
        onStderr: (data) => { process.stderr.write(data); }
      }
    )

    if (initResult.exitCode !== 0) {
      throw new Error(`Template initialization failed: ${initResult.stderr}`)
    }

    // Set environment variables if provided
    if (Object.keys(envVars).length > 0) {
      console.log('\n🔐 Setting environment variables...')
      const envContent = Object.entries(envVars)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')

      await sandbox.files.write('/home/user/.env.local', envContent)
      await sandbox.files.write('/home/user/app/.env', envContent)
      console.log(`✅ Set ${Object.keys(envVars).length} environment variables`)
    }

    // setup github token
    if (process.env.GITHUB_TOKEN) {
      await sandbox.commands.run(
        `cd /home/user/app && ./scripts/git_ops.sh setupGh ${process.env.GITHUB_TOKEN}`
      )
    }

    // Start Next.js
    console.log('\n🌐 Starting Next.js server on port 3000...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup pnpm run dev > /tmp/nextjs.log 2>&1 &',
      {
        background: true
      }
    )

    // Start Mastra
    console.log('⚙️  Starting Mastra dev server on port 4111...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup pnpm run mastraDev > /tmp/mastra.log 2>&1 &',
      {
        background: true
      }
    )

    // Health check function
    const healthCheck = async (
      port: number,
      serviceName: string,
      retries = healthCheckRetries
    ): Promise<{ url: string; ready: boolean }> => {
      const host = sandbox.getHost(port)
      const url = `https://${host}`

      console.log(`\n🔍 Performing health checks for ${serviceName}...`)

      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })

          console.log(`   Attempt ${i + 1}/${retries}: ${response.status} ${response.statusText}`)

          if (response.ok || response.status === 404 || response.status === 500) {
            // Server is responding (even with errors means it's running)
            console.log(`✅ ${serviceName} is ready at ${url}`)
            return { url, ready: true }
          }
        } catch (error: any) {
          const errorMsg = error.message || 'Connection failed'
          console.log(`   Attempt ${i + 1}/${retries}: ${errorMsg}`)

          if (i === retries - 1) {
            // On last retry, check logs
            console.error(`\n❌ ${serviceName} health check failed after ${retries} attempts`)
            try {
              const logs = await sandbox.files.read(`/tmp/dev.log`)
              console.error(`\n📋 ${serviceName} Logs (last 50 lines):`)
              const logLines = logs.split('\n').slice(-50)
              console.error(logLines.join('\n'))
            } catch (logError) {
              console.error('Could not read logs')
            }
            throw new Error(`${serviceName} failed to start`)
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
      throw new Error(`${serviceName} failed after all retries`)
    }

    // Wait for service to be ready
    console.log('\n⏳ Waiting for service to start...')
    console.log('This may take 30-60 seconds...')

    const devHealth = await healthCheck(3000, 'Development Server')

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 DEPLOYMENT SUCCESSFUL!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n📱 Application:  ', devHealth.url)
    console.log('🆔 Sandbox ID:   ', sandbox.sandboxId)
    console.log('📋 Template:     ', templateName)
    console.log('\n💡 Tip: Sandbox will auto-terminate after 1 hour (hobby tier)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return {
      sandbox,
      sandboxId: sandbox.sandboxId,
      url: devHealth.url,
      // Helper function to get logs
      getLogs: async () => {
        try {
          const devLogs = await sandbox.files.read('/tmp/dev.log')
          return { devLogs }
        } catch (error) {
          console.error('Error reading logs:', error)
          return { devLogs: '' }
        }
      },
      // Helper to extend sandbox lifetime
      extendTimeout: async (hours: number = 1) => {
        const ms = hours * 60 * 60 * 1000
        await sandbox.setTimeout(ms)
        console.log(`⏱️  Sandbox timeout extended by ${hours} hour(s)`)
      }
    }

  } catch (error: any) {
    console.error('\n💥 DEPLOYMENT FAILED:', error.message)

    // Try to get logs before killing
    console.log('\n📋 Attempting to retrieve logs...')
    try {
      const devLogs = await sandbox.files.read('/tmp/dev.log')

      if (devLogs) {
        console.error('\n━━━ Development Server Logs (last 30 lines) ━━━')
        console.error(devLogs.split('\n').slice(-30).join('\n'))
      }
    } catch (logError) {
      console.error('Could not retrieve logs')
    }

    console.log('\n🧹 Cleaning up sandbox...')
    await sandbox.kill()
    throw error
  }
}

/**
 * Execute a command in an existing sandbox with cancellation support
 */
export async function executeInSandbox(
  sandboxId: string,
  command: string,
  workingDir?: string
) {
  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY must be set");
  }

  let sandbox: Sandbox | null = null;
  let killed = false;
  const pidFile = `/tmp/process_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.pid`;

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

    // Execute command with PID tracking
    console.log(`\nExecuting: ${command}\n`);

    // Wrap command to save PID for later killing
    const wrappedCommand = `
      (
        ${workingDir ? `cd ${workingDir} && ` : ''}${command}
      ) &
      echo $! > ${pidFile}
      wait $!
      EXIT_CODE=$?
      rm -f ${pidFile}
      exit $EXIT_CODE
    `;

    // Create a promise that will run the command
    const commandPromise = sandbox.commands.run(wrappedCommand, {
      timeoutMs: 600000, // 10 minutes
      onStdout: (data: string) => { console.log(data); },
      onStderr: (data: string) => { console.error(data); }
    });

    // Store sandbox reference for closures
    const sbx = sandbox;

    // Return a killable process interface
    return {
      process: {
        kill: async (signal?: string) => {
          killed = true;
          try {
            // Read the PID from the file
            const pidResult = await sbx.commands.run(`cat ${pidFile} 2>/dev/null || echo ""`);
            const pid = pidResult.stdout.trim();

            if (pid) {
              // Kill the process by PID
              await sbx.commands.run(`kill -${signal || 'TERM'} ${pid} 2>/dev/null || true`);
              console.log(`Killed process ${pid} with signal ${signal || 'TERM'}`);
            }

            // Clean up PID file
            await sbx.commands.run(`rm -f ${pidFile}`);
          } catch (error) {
            console.error("Error killing process:", error);
          }
        },
        wait: async () => {
          const result = await commandPromise;
          return { code: result.exitCode };
        }
      },
      sandbox: sbx,
      // Wait for the process to complete
      wait: async () => {
        if (killed) {
          throw new Error("Process was killed");
        }
        const result = await commandPromise;
        console.log("=== PROCESS COMPLETED ===");
        console.log("Exit code:", result.exitCode);

        if (result.exitCode !== 0) {
          throw new Error(`Command exited with code ${result.exitCode}`);
        }

        return result;
      }
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Remove/kill a sandbox
 */
export async function removeSandbox(sandboxId: string) {
  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY must be set");
  }

  try {
    console.log(`Removing sandbox: ${sandboxId}...`);
    const sandbox = await Sandbox.connect(sandboxId);

    await sandbox.kill();
    console.log("✓ Sandbox removed successfully");
    return { success: true };
  } catch (error) {
    throw error;
  }
}
