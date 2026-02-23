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
  gitBranch?: string;
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
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
    healthCheckRetries = 15,
    gitBranch,
    onLog = console.log,
    onError = console.error
  } = config

  onLog('🚀 Starting deployment...')
  onLog('📝 Template Name:', templateName)

  const sandbox = await Sandbox.create(templateName, {
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 1_800_000 // 30 minutes
  })

  try {
    onLog('✅ Sandbox created:', sandbox.sandboxId)

    // Create template from E2B template
    onLog('\n📦 Creating environment from template...')

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
      onLog('\n🔐 Setting environment variables...')
      const envContent = Object.entries(envVars)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')

      await sandbox.files.write('/home/user/.env.local', envContent)
      await sandbox.files.write('/home/user/app/.env', envContent)
      onLog(`✅ Set ${Object.keys(envVars).length} environment variables`)
    }

    // setup github token
    if (process.env.GITHUB_TOKEN) {
      await sandbox.commands.run(
        `cd /home/user/app && ./scripts/git_ops.sh setupGh ${process.env.GITHUB_TOKEN}`
      )
    }

    // Switch to git branch if specified
    if (gitBranch) {
      onLog(`\n🔀 Switching to git branch: ${gitBranch}...`)
      const gitResult = await sandbox.commands.run(
        `cd /home/user/app && ./scripts/git_ops.sh fetchAndSwitch ${gitBranch}`,
        {
          onStdout: (data) => { process.stdout.write(data); },
          onStderr: (data) => { process.stderr.write(data); }
        }
      )

      if (gitResult.exitCode !== 0) {
        throw new Error(`Failed to switch to branch ${gitBranch}: ${gitResult.stderr}`)
      }
      onLog(`✅ Switched to branch: ${gitBranch}`)
    }

    // Install dependencies (must complete before starting servers)
    onLog('\n🌐 Installing dependencies...')
    await sandbox.commands.run(
      'cd /home/user/app && CI=true pnpm install'
    )

    // Start Next.js
    onLog('\n🌐 Starting Next.js server on port 3000...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup pnpm run dev > /tmp/nextjs.log 2>&1 &',
      {
        background: true
      }
    )

    // Start Mastra
    onLog('⚙️  Starting Mastra dev server on port 4111...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup pnpm run mastraDev > /tmp/mastra.log 2>&1 &',
      {
        background: true
      }
    )

    // Start Kimi Web
    onLog('⚙️  Starting Kimi web server on port 5494...')
    await sandbox.commands.run(
      `export KIMI_API_KEY=${process.env.KIMI_API_KEY}; cd /home/user/app && nohup kimi web > /tmp/kimi_web.log 2>&1 &`,
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

      onLog(`\n🔍 Performing health checks for ${serviceName}...`)

      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })

          onLog(`   Attempt ${i + 1}/${retries}: ${response.status} ${response.statusText}`)

          if (response.ok || response.status === 404 || response.status === 500) {
            // Server is responding (even with errors means it's running)
            onLog(`✅ ${serviceName} is ready at ${url}`)
            return { url, ready: true }
          }
        } catch (error: any) {
          const errorMsg = error.message || 'Connection failed'
          onLog(`   Attempt ${i + 1}/${retries}: ${errorMsg}`)

          if (i === retries - 1) {
            // On last retry, check logs
            onError(`\n❌ ${serviceName} health check failed after ${retries} attempts`)
            try {
              const logs = await sandbox.files.read(`/tmp/dev.log`)
              onError(`\n📋 ${serviceName} Logs (last 50 lines):`)
              const logLines = logs.split('\n').slice(-50)
              onError(logLines.join('\n'))
            } catch (logError) {
              onError('Could not read logs')
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
    onLog('\n⏳ Waiting for service to start...')
    onLog('This may take 30-60 seconds...')

    const devHealth = await healthCheck(3000, 'Development Server')

    onLog('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    onLog('🎉 DEPLOYMENT SUCCESSFUL!')
    onLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    onLog('\n📱 Application:  ', devHealth.url)
    onLog('🆔 Sandbox ID:   ', sandbox.sandboxId)
    onLog('📋 Template:     ', templateName)
    onLog('\n💡 Tip: Sandbox will auto-terminate after 20 minutes. Save to git regularly!')
    onLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')


    onLog('⚙️  Patching Mastra studio...')
    const patchResult = await sandbox.commands.run(
      'cd /home/user/app && sleep 5; node scripts/patch-studio.mjs',
      {
        background: true
      }
    )
    onLog('✅ Mastra studio patched with result: ', patchResult.stdout)

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
          onError('Error reading logs:', error)
          return { devLogs: '' }
        }
      },
      // Helper to extend sandbox lifetime
      extendTimeout: async (hours: number = 1) => {
        const ms = hours * 60 * 60 * 1000
        await sandbox.setTimeout(ms)
        onLog(`⏱️  Sandbox timeout extended by ${hours} hour(s)`)
      }
    }

  } catch (error: any) {
    onError('\n💥 DEPLOYMENT FAILED:', error.message)

    // Try to get logs before killing
    onLog('\n📋 Attempting to retrieve logs...')
    try {
      const devLogs = await sandbox.files.read('/tmp/dev.log')

      if (devLogs) {
        onError('\n━━━ Development Server Logs (last 30 lines) ━━━')
        onError(devLogs.split('\n').slice(-30).join('\n'))
      }
    } catch (logError) {
      onError('Could not retrieve logs')
    }

    onLog('\n🧹 Cleaning up sandbox...')
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
  workingDir?: string,
  onLog?: (message: string) => void,
  onError?: (message: string) => void
) {
  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY must be set");
  }

  // Use provided callbacks or fall back to console
  const log = onLog || console.log;
  const error = onError || console.error;

  let sandbox: Sandbox | null = null;
  let killed = false;
  const pidFile = `/tmp/process_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.pid`;

  try {
    // Connect to the sandbox
    log(`Connecting to sandbox: ${sandboxId}`);
    sandbox = await Sandbox.connect(sandboxId);

    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    log(`✓ Connected to sandbox`);

    // Working directory is not needed in E2b, but we can use it in the command if specified
    if (workingDir) {
      log(`Working directory: ${workingDir}`);
    }

    // Execute command with PID tracking
    log(`\nExecuting: ${command}\n`);

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
      onStdout: (data: string) => { log(data); },
      onStderr: (data: string) => { error(data); }
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
              log(`Killed process ${pid} with signal ${signal || 'TERM'}`);
            }

            // Clean up PID file
            await sbx.commands.run(`rm -f ${pidFile}`);
          } catch (killError) {
            error("Error killing process:", killError);
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
        log("=== PROCESS COMPLETED ===");
        log("Exit code:", result.exitCode);

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
