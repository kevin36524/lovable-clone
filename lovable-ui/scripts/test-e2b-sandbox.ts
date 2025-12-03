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

// Load environment variables


interface DeploymentConfig {
  repoUrl: string;
  branch?: string;
  envVars?: Record<string, string>;
  waitTimeout?: number;
  healthCheckRetries?: number;
}

async function deployNextJsMastraApp(config: DeploymentConfig) {
  const {
    repoUrl,
    branch = 'main',
    envVars = {},
    waitTimeout = 60000,
    healthCheckRetries = 15
  } = config
  
  console.log('🚀 Starting deployment...')
  console.log('📍 Repository:', repoUrl)
  console.log('🌿 Branch:', branch)
  
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 1800_000 // 30 minutes
  })
  
  try {
    console.log('✅ Sandbox created:', sandbox.sandboxId)
    
    // Clone repository
    console.log('\n📦 Cloning repository...')
    const cloneCmd = branch 
      ? `git clone -b ${branch} --depth 1 ${repoUrl} /home/user/app`
      : `git clone ${repoUrl} /home/user/app`
    
    const cloneResult = await sandbox.commands.run(cloneCmd, {
      onStdout: (data) => process.stdout.write(data),
      onStderr: (data) => process.stderr.write(data)
    })
    
    if (cloneResult.exitCode !== 0) {
      throw new Error(`Git clone failed: ${cloneResult.stderr}`)
    }
    
    // Set environment variables if provided
    if (Object.keys(envVars).length > 0) {
      console.log('\n🔐 Setting environment variables...')
      const envContent = Object.entries(envVars)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
      
      await sandbox.files.write('/home/user/app/.env.local', envContent)
      console.log(`✅ Set ${Object.keys(envVars).length} environment variables`)
    }
    
    // Install dependencies
    console.log('\n📥 Installing dependencies (this may take a while)...')
    const installResult = await sandbox.commands.run(
      'cd /home/user/app && npm install',
      {
        timeoutMs: 600000, // 10 minutes
        onStdout: (data) => console.log(data),
        onStderr: (data) => console.error(data)
      }
    )
    
    if (installResult.exitCode !== 0) {
      throw new Error(`npm install failed with exit code ${installResult.exitCode}`)
    }
    
    console.log('✅ Dependencies installed successfully')
    
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
              const logFileName = serviceName.toLowerCase().replace(/\s+/g, '')
              const logs = await sandbox.files.read(`/tmp/${logFileName}.log`)
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
    
    // Wait for both services to be ready
    console.log('\n⏳ Waiting for services to start...')
    console.log('This may take 30-60 seconds...')
    
    const [nextjsHealth, mastraHealth] = await Promise.all([
      healthCheck(3000, 'Next.js'),
      healthCheck(4111, 'Mastra')
    ])
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 DEPLOYMENT SUCCESSFUL!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n📱 Next.js App:  ', nextjsHealth.url)
    console.log('🔧 Mastra Dev:   ', mastraHealth.url)
    console.log('🆔 Sandbox ID:   ', sandbox.sandboxId)
    console.log('\n💡 Tip: Sandbox will auto-terminate after 1 hour (hobby tier)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    return {
      sandbox,
      sandboxId: sandbox.sandboxId,
      urls: {
        nextjs: nextjsHealth.url,
        mastra: mastraHealth.url
      },
      // Helper function to get logs
      getLogs: async () => {
        try {
          const nextjsLogs = await sandbox.files.read('/tmp/nextjs.log')
          const mastraLogs = await sandbox.files.read('/tmp/mastra.log')
          return { nextjsLogs, mastraLogs }
        } catch (error) {
          console.error('Error reading logs:', error)
          return { nextjsLogs: '', mastraLogs: '' }
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
      const nextjsLogs = await sandbox.files.read('/tmp/nextjs.log')
      const mastraLogs = await sandbox.files.read('/tmp/mastra.log')
      
      if (nextjsLogs) {
        console.error('\n━━━ Next.js Logs (last 30 lines) ━━━')
        console.error(nextjsLogs.split('\n').slice(-30).join('\n'))
      }
      
      if (mastraLogs) {
        console.error('\n━━━ Mastra Logs (last 30 lines) ━━━')
        console.error(mastraLogs.split('\n').slice(-30).join('\n'))
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

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn('⚠️  Warning: GOOGLE_GENERATIVE_AI_API_KEY is not set')
    console.warn('Your app may not function correctly without it')
  }

  try {
    const deployment = await deployNextJsMastraApp({
      repoUrl: 'https://github.com/kevin36524/hack-skeleton-app',
      branch: 'joke',
      envVars: {
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        NODE_ENV: 'development',
        // Add any other env vars your app needs
      },
      waitTimeout: 60000,
      healthCheckRetries: 20 // Increased retries for slower starts
    })
    
    // Share URLs with user
    console.log('📤 Share these URLs with your users:')
    console.log('   Frontend:', deployment.urls.nextjs)
    console.log('   Mastra API:', deployment.urls.mastra)
    
    // Optional: Get logs after successful deployment
    if (process.argv.includes('--logs')) {
      console.log('\n📋 Fetching logs...')
      const logs = await deployment.getLogs()
      console.log('\nNext.js logs:\n', logs.nextjsLogs)
      console.log('\nMastra logs:\n', logs.mastraLogs)
    }
    
    // Keep the process running to prevent sandbox from being killed
    console.log('\n⏸️  Press Ctrl+C to stop and cleanup the sandbox')
    
    // Keep alive
    await new Promise(() => {}) // Never resolves
    
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