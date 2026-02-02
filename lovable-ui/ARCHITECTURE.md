# Hackable-UI Engineering Documentation

## Overview

Hackable-UI is an AI-powered development platform that enables rapid prototyping and deployment of applications using isolated cloud sandboxes. The platform combines Next.js, Claude AI, E2B sandboxes, and Google Cloud Run to provide a complete development environment accessible through a web interface.

**Key Technologies:**
- **Frontend:** Next.js 14 + React 18 + TypeScript
- **Authentication:** Google OAuth 2.0 with JWT sessions
- **AI Integration:** Claude Agent SDK
- **Sandbox Environment:** E2B Code Interpreter
- **Cloud Deployment:** Google Cloud Run + Cloud Build

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [E2B Sandbox Lifecycle](#e2b-sandbox-lifecycle)
3. [Secrets Injection](#secrets-injection)
4. [Sandbox Utils API](#sandbox-utils-api)
5. [Architecture Diagram](#architecture-diagram)

---

## Authentication System

### Overview

Authentication uses Google OAuth 2.0 with domain-based access control. Only users from approved email domains can access the platform.

### Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  /api/auth/      │────▶│  Google OAuth   │
│  (Browser)  │◄────│  signin/google   │◄────│   (consent)     │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                                               │
       │                                               ▼
       │                                       ┌─────────────────┐
       │                                       │  Authorization  │
       │                                       │     Code        │
       │                                       └─────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cookie    │◄────│ /api/auth/       │◄────│   Code + Token  │
│  (Session)  │     │ callback/google  │     │    Exchange     │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Components

#### 1. Middleware Protection (`middleware.ts`)

The Next.js middleware protects routes before they reach the application:

```typescript
// Protected routes
const isProtectedPath =
  (path.startsWith('/generate') || path.startsWith('/api')) &&
  !path.startsWith('/api/auth');
```

**Behavior:**
- Validates JWT session on every request
- Redirects unauthenticated users to `/login` with `returnTo` parameter
- Allows public access to `/api/auth/*` endpoints

#### 2. Session Management (`lib/auth.ts`)

Uses `jose` library for JWT signing/verification:

```typescript
// Session Configuration
const COOKIE_NAME = 'hackable_session';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Cookie Settings
httpOnly: true,
secure: process.env.NODE_ENV === 'production',
sameSite: 'lax',
maxAge: SESSION_DURATION
```

**JWT Payload:**
```typescript
{
  userId: string;
  email: string;
  name: string;
  picture: string;
  iat: number;
  exp: number;
}
```

#### 3. Google OAuth Flow (`lib/google-oauth.ts`)

**Sign In (`/api/auth/signin/google`):**
1. Generates random `state` parameter (CSRF protection)
2. Stores state in short-lived cookie (5 minutes)
3. Redirects to Google OAuth consent screen

**Callback (`/api/auth/callback/google`):**
1. Validates state matches stored value
2. Exchanges authorization code for access token
3. Fetches user info from Google API
4. Validates email domain against `ALLOWED_EMAIL_DOMAINS`
5. Creates JWT session and sets cookie

**Domain Validation:**
```typescript
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',');
// Example: ALLOWED_EMAIL_DOMAINS=yahooinc.com,oath.email
```

#### 4. React Context (`contexts/AuthContext.tsx`)

Provides authentication state to the React component tree:

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}
```

---

## E2B Sandbox Lifecycle

### Overview

E2B (Execution to Binary) provides isolated sandbox environments for running user code. Each sandbox is a temporary Linux environment that auto-terminates after 20 minutes.

### Lifecycle Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  POST /api/      │────▶│  E2B Template   │
│   Request   │     │  deploy-e2b      │     │   (Docker img)  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────────┐
                                               │   Sandbox       │
                                               │   Instance      │
                                               └─────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       │                              │                              │
                       ▼                              ▼                              ▼
                ┌─────────────┐              ┌─────────────┐                ┌─────────────┐
                │  Secrets    │              │   Servers   │                │   Health    │
                │  Injection  │              │   Startup   │                │    Check    │
                └─────────────┘              └─────────────┘                └─────────────┘
                       │                              │                              │
                       ▼                              ▼                              ▼
                Write .env.local              Start Next.js                   Poll URL every
                Write app/.env                Start Mastra                    3s for 200 OK
```

### Sandbox Creation

**Core Function:** `deployTemplateInSandbox()` in `e2b_utils/index.ts`

```typescript
const sandbox = await Sandbox.create(templateName, {
  apiKey: process.env.E2B_API_KEY,
  timeoutMs: 1_200_000 // 20 minutes
});
```

**Templates:**
- `app-with-mastra` - Full-stack Next.js app with Mastra AI framework
- `app-with-mail-mastra` - Mail-specific Mastra template

### Server Startup Sequence

1. **Environment Setup** - Write secrets to `.env.local` and `app/.env`
2. **Git Configuration** - Optionally checkout specific branch
3. **Next.js Server** - Start on port 3000
4. **Mastra Server** - Start on port 4111
5. **Health Checks** - Poll until servers respond

**Startup Commands:**
```bash
# Next.js dev server
cd /home/user/app && pnpm run dev > /tmp/nextjs.log 2>&1 &

# Mastra dev server
cd /home/user/app && pnpm run mastraDev > /tmp/mastra.log 2>&1 &
```

**Health Check Logic:**
```typescript
const url = `https://${sandbox.getHost(3000)}`;
// Poll every 3 seconds, retry up to 20 times
// Success on HTTP 200, 404, or 500 (any response = server running)
```

### Command Execution

Execute commands in running sandboxes via `executeInSandbox()`:

```typescript
const execution = await executeInSandbox(
  sandboxId,
  'pnpx tsx scripts/feature-assistant.ts',
  '/home/user/app',
  onLog,      // stdout callback
  onError     // stderr callback
);
```

**Features:**
- Working directory support
- Real-time output streaming
- Process cancellation via PID tracking
- 10-minute timeout per command

### Sandbox Termination

Sandboxes can be killed immediately:

```typescript
// In removeSandbox()
const sandbox = await Sandbox.connect(sandboxId);
await sandbox.kill();
```

**Auto-termination:**
- Sandboxes auto-kill after 20 minutes (configured at creation)
- UI shows 5-minute warning before expiration

---

## Secrets Injection

### Overview

API keys and environment variables are injected into sandboxes at creation time. The system supports both E2B sandbox and Google Cloud Run deployments.

### E2B Sandbox Injection

**API Endpoint:** `POST /api/deploy-e2b`

**Environment Variables Passed:**

```typescript
envVars: {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  NODE_ENV: 'development',
}
```

**Injection Process (`e2b_utils/index.ts:74-84`):**

```typescript
const envContent = Object.entries(envVars)
  .filter(([_, value]) => value !== undefined && value !== null)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

// Write to both locations for maximum compatibility
await sandbox.files.write('/home/user/.env.local', envContent);
await sandbox.files.write('/home/user/app/.env', envContent);
```

**GitHub Token Setup:**

```typescript
if (process.env.GITHUB_TOKEN) {
  await sandbox.commands.run(
    `cd /home/user/app && ./scripts/git_ops.sh setupGh ${process.env.GITHUB_TOKEN}`
  );
}
```

### Cloud Run Deployment Injection

**File:** `lib/cloudrun-deploy.ts`

Environment variables are injected via Cloud Run service configuration:

```typescript
const envVars = [
  `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  `GOOGLE_GENERATIVE_AI_API_KEY=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
  `ELEVENLABS_API_KEY=${process.env.ELEVENLABS_API_KEY}`,
  `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`,
].join(',');

// Used in gcloud run deploy command
`--set-env-vars=${envVars}`
```

### Security Considerations

| Concern | Current State | Recommendation |
|---------|--------------|----------------|
| Secret Storage | Hardcoded in `.env` file | Use Google Secret Manager or similar |
| Transmission | Passed via environment variables | Use encrypted volume mounts where possible |
| Logging | Secrets may appear in logs | Implement log sanitization |
| Access Control | Domain-based only | Add role-based access control (RBAC) |

---

## Sandbox Utils API

### File Location

`e2b_utils/index.ts` - Core sandbox operations module

### Functions

#### `deployTemplateInSandbox(config)`

Creates and configures an E2B sandbox from a template.

**Parameters:**

```typescript
interface DeployConfig {
  templateName: string;           // E2B template ID
  envVars: Record<string, string>; // Environment variables
  waitTimeout?: number;           // Health check timeout (default: 60000ms)
  healthCheckRetries?: number;    // Number of retries (default: 15)
  gitBranch?: string;             // Optional git branch to checkout
  onLog?: (message: string) => void;   // stdout callback
  onError?: (message: string) => void; // stderr callback
}
```

**Returns:**

```typescript
{
  sandbox: Sandbox;              // E2B sandbox instance
  sandboxId: string;             // Unique sandbox identifier
  url: string;                   // Public URL to sandbox port 3000
  getLogs: () => Promise<string>; // Function to fetch server logs
  extendTimeout: () => Promise<void>; // Extend sandbox timeout
}
```

**Example Usage:**

```typescript
const { sandboxId, url, getLogs } = await deployTemplateInSandbox({
  templateName: "app-with-mastra",
  envVars: { ANTHROPIC_API_KEY: "..." },
  waitTimeout: 60000,
  healthCheckRetries: 20,
  gitBranch: "feature/new-ui",
  onLog: (msg) => console.log(`[INFO] ${msg}`),
  onError: (msg) => console.error(`[ERROR] ${msg}`)
});
```

#### `executeInSandbox(sandboxId, command, workingDir, onLog, onError)`

Executes a command in an existing sandbox with real-time output streaming.

**Parameters:**

```typescript
sandboxId: string           // Sandbox identifier from deployTemplateInSandbox
command: string             // Shell command to execute
workingDir?: string         // Working directory (default: /home/user)
onLog?: (output: string) => void    // stdout handler
onError?: (error: string) => void   // stderr handler
```

**Returns:**

```typescript
{
  process: {
    kill: () => Promise<void>;  // Terminate the process
    wait: () => Promise<void>;  // Wait for completion
  };
  sandbox: Sandbox;             // Connected sandbox instance
  wait: () => Promise<void>;    // Wait for command completion
}
```

**Example Usage:**

```typescript
const execution = await executeInSandbox(
  sandboxId,
  'pnpm run build',
  '/home/user/app',
  (output) => sendToClient(output),
  (error) => sendToClient(error)
);

// Track for cancellation
runningProcesses.set(requestId, execution.process);

// Wait for completion
try {
  await execution.wait();
} finally {
  runningProcesses.delete(requestId);
}
```

**Cancellation Support:**

```typescript
// Cancel a running process
const process = runningProcesses.get(requestId);
if (process) {
  await process.kill();
}
```

#### `removeSandbox(sandboxId)`

Immediately terminates a sandbox and all its processes.

**Parameters:**

```typescript
sandboxId: string  // Sandbox identifier
```

**Returns:**

```typescript
{ success: true }
```

**Example Usage:**

```typescript
await removeSandbox(sandboxId);
// Sandbox is now terminated and resources freed
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Login     │  │  Template   │  │  Generate   │  │   Deployment        │ │
│  │    Page     │  │  Selection  │  │    Page     │  │   Dashboard         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS API LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │/api/auth/*  │  │/api/deploy- │  │/api/execute-│  │/api/deploy-cloudrun │ │
│  │             │  │    e2b      │  │  command    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐                                          │
│  │/api/kill-   │  │/api/cancel- │                                          │
│  │  sandbox    │  │  execution  │                                          │
│  └─────────────┘  └─────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
┌─────────────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    E2B SANDBOXES        │  │  CLOUD RUN      │  │  EXTERNAL APIs  │
│  ┌─────────────────┐    │  │  ┌───────────┐  │  │  ┌───────────┐  │
│  │   Next.js App   │    │  │  │ Container │  │  │  │  Google   │  │
│  │   (Port 3000)   │    │  │  │  Service  │  │  │  │   OAuth   │  │
│  ├─────────────────┤    │  │  └───────────┘  │  │  └───────────┘  │
│  │  Mastra Server  │    │  │                 │  │  ┌───────────┐  │
│  │   (Port 4111)   │    │  │  Cloud Build    │  │  │    E2B    │  │
│  ├─────────────────┤    │  │  (CI/CD)        │  │  │  Service  │  │
│  │  Claude Agent   │────┼──┼─────────────────┼──┼──│           │  │
│  │  (AI Assistant) │    │  │                 │  │  └───────────┘  │
│  └─────────────────┘    │  └─────────────────┘  └─────────────────┘
└─────────────────────────┘
```

---

## File Reference Map

| Component | File Path |
|-----------|-----------|
| Authentication Middleware | `middleware.ts` |
| JWT Session Management | `lib/auth.ts` |
| Google OAuth Helpers | `lib/google-oauth.ts` |
| React Auth Context | `contexts/AuthContext.tsx` |
| E2B Sandbox Utils | `e2b_utils/index.ts` |
| Deploy E2B API | `app/api/deploy-e2b/route.ts` |
| Execute Command API | `app/api/execute-command/route.ts` |
| Kill Sandbox API | `app/api/kill-sandbox/route.ts` |
| Cloud Run Deploy | `lib/cloudrun-deploy.ts` |
| Process Tracking | `lib/process-tracker.ts` |
| Claude Integration | `lib/claude-code.ts` |

---

## Environment Variables

### Required

```bash
# Authentication
JWT_SECRET=random-secret-key
GOOGLE_CLIENT_ID=google-oauth-client-id
GOOGLE_CLIENT_SECRET=google-oauth-client-secret
ALLOWED_EMAIL_DOMAINS=yahooinc.com,oath.email

# E2B Sandbox
E2B_API_KEY=e2b-api-key

# AI Services
ANTHROPIC_API_KEY=anthropic-api-key

# Database (optional)
NEXT_PUBLIC_SUPABASE_URL=supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=supabase-anon-key

# Additional AI Providers (optional)
GOOGLE_GENERATIVE_AI_API_KEY=google-ai-key
OPENAI_API_KEY=openai-key
ELEVENLABS_API_KEY=elevenlabs-key

# Deployment
GITHUB_TOKEN=github-personal-access-token
```

---

*Generated: 2026-02-01*
