import { Sandbox } from '@e2b/code-interpreter'
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.E2B_API_KEY || !process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: E2B_API_KEY and ANTHROPIC_API_KEY must be set");
  console.log(path.join(__dirname, "../../.env"))
  process.exit(1);
}

interface DeploymentConfig {
  templateName: string;
  envVars?: Record<string, string>;
  waitTimeout?: number;
  healthCheckRetries?: number;
}

async function deployTemplateInSandbox(config: DeploymentConfig) {
  const {
    templateName,
    envVars = {},
    waitTimeout = 60000,
    healthCheckRetries = 15
  } = config

  console.log('🚀 Starting deployment...')
  console.log('📝 Template Name:', templateName)

  const sandbox = await Sandbox.create(templateName,{
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
        onStdout: (data) => process.stdout.write(data),
        onStderr: (data) => process.stderr.write(data)
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

    // Start Next.js
    console.log('\n🌐 Starting Next.js server on port 3000...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup npm run dev > /tmp/nextjs.log 2>&1 &',
      {
        background: true
      }
    )

    // Start Mastra
    console.log('⚙️  Starting Mastra dev server on port 4111...')
    await sandbox.commands.run(
      'cd /home/user/app && nohup npm run mastraDev > /tmp/mastra.log 2>&1 &',
      {
        background: true
      }
    )

    // Health check function
    const healthCheck = async (
      port: number,
      serviceName: string,
      retries = healthCheckRetries
    ) => {
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

// Main execution
async function main() {
  // Validate environment variables
  if (!process.env.E2B_API_KEY) {
    console.error('❌ Error: E2B_API_KEY is not set in environment variables')
    console.error('Please add it to your .env file or set it as an environment variable')
    process.exit(1)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY is not set in environment variables')
    process.exit(1)
  }

  // Get template config from environment variables or use defaults
  const templateName = process.env.TEMPLATE_NAME || 'hack-skeleton-joke';

  try {
    const deployment = await deployTemplateInSandbox({
      templateName,
      envVars: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
        NODE_ENV: 'development',
        // Add any other env vars your template needs
      },
      waitTimeout: 60000,
      healthCheckRetries: 20
    })

    // Share URL with user
    console.log('📤 Application deployed successfully!')
    console.log('   Application:', deployment.url)
    console.log('   Sandbox ID:', deployment.sandboxId)

    // Optional: Get logs after successful deployment
    if (process.argv.includes('--logs')) {
      console.log('\n📋 Fetching logs...')
      const logs = await deployment.getLogs()
      console.log('\nDev server logs:\n', logs.devLogs)
    }

    // Exit successfully - sandbox will remain running
    console.log('\n✅ Deployment complete!')
    process.exit(0)

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Received SIGINT, cleaning up...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 Received SIGTERM, cleaning up...')
  process.exit(0)
})

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
