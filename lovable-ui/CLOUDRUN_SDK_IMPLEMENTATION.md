# Cloud Run Deployment using Google Cloud SDK

## Context
We're implementing a Cloud Run deployment feature that deploys a GitHub repository branch to Google Cloud Run. The gcloud CLI approach had PATH issues, so we're switching to the Google Cloud SDK approach using Node.js client libraries.

## Current Implementation (CLI-based - has issues)
- **Location**: `/lib/cloudrun-deploy.ts` and `/app/api/deploy-cloudrun/route.ts`
- **Problem**: `spawn gcloud ENOENT` - PATH issues with gcloud CLI in Cloud Run container
- **Flow**: Clone GitHub repo → Run gcloud CLI → Deploy

## Target Implementation (SDK-based)

### Required Packages
```bash
npm install @google-cloud/cloudbuild @google-cloud/run
```

### Architecture
Use two Google Cloud SDKs:
1. **@google-cloud/cloudbuild** - Build Docker image from GitHub source
2. **@google-cloud/run** - Deploy the built image to Cloud Run

### Implementation Requirements

#### 1. Update `/lib/cloudrun-deploy.ts`

Replace the current functions with SDK-based versions:

**Function: `buildFromGitHub`**
- Use Cloud Build API to trigger a build from GitHub repository
- Input: `branchName`, `repoOwner`, `repoName`, `onProgress` callback
- Build configuration:
  - Source: GitHub repository at specific branch
  - Builder: Use Cloud Build with buildpacks or Dockerfile
  - Destination: Google Container Registry or Artifact Registry
- Return: Image URI (e.g., `gcr.io/twiliotest-8d802/lovable-ui:branch-name`)
- Stream build logs back to the client via `onProgress`

**Function: `deployToCloudRunSDK`**
- Use Cloud Run API to deploy the built image
- Input: `serviceName`, `imageUri`, `envVars`, `onProgress` callback
- Configuration:
  - Project: `twiliotest-8d802`
  - Region: `us-central1`
  - Platform: managed
  - Allow unauthenticated: true
  - Service account: `calproxy-service-account@twiliotest-8d802.iam.gserviceaccount.com`
  - Environment variables from `envVars` object
- Return: `{ serviceUrl: string }`
- Stream deployment progress via `onProgress`

**Function: `sanitizeServiceName`** (keep as-is)
- Sanitize branch name for Cloud Run service naming
- Replace "/" with "_", convert to lowercase

**Function: `buildEnvVarString`** (convert to object)
- Change return type from string to object
- Return: `{ NEXT_PUBLIC_SUPABASE_URL: string, ... }`

#### 2. Update `/app/api/deploy-cloudrun/route.ts`

Update the API endpoint to use SDK functions:

```typescript
// Pseudo-code flow:
1. Validate branch name
2. Generate request ID
3. Sanitize service name
4. Build env vars object
5. Call buildFromGitHub() - stream build logs
6. Get imageUri from build result
7. Call deployToCloudRunSDK() - stream deployment logs
8. Return service URL
```

#### 3. Authentication
- Use Application Default Credentials (ADC)
- Since the app runs on Cloud Run with a service account, credentials are automatic
- No need for key files or explicit authentication

#### 4. Keep existing UI unchanged
- `/app/generate/page.tsx` - No changes needed
- The API contract remains the same (POST /api/deploy-cloudrun with branchName)

### Key SDK Methods to Use

**Cloud Build Client:**
```typescript
import { CloudBuildClient } from '@google-cloud/cloudbuild';

const buildClient = new CloudBuildClient();

// Create build from GitHub source
await buildClient.createBuild({
  projectId: 'twiliotest-8d802',
  build: {
    source: {
      repoSource: {
        projectId: 'twiliotest-8d802',
        repoName: 'github_kevin36524_hack-skeleton-app', // GitHub repo connection
        branchName: branchName,
      }
    },
    steps: [...], // Build steps
    images: [imageUri],
  }
});
```

**Cloud Run Client:**
```typescript
import { ServicesClient } from '@google-cloud/run';

const runClient = new ServicesClient();

// Deploy service
await runClient.replaceService({
  name: `projects/twiliotest-8d802/locations/us-central1/services/${serviceName}`,
  service: {
    template: {
      containers: [{
        image: imageUri,
        env: envVarsArray,
      }],
      serviceAccount: 'calproxy-service-account@twiliotest-8d802.iam.gserviceaccount.com',
    },
  },
});
```

### GitHub Repository Configuration
- Repository: `https://github.com/kevin36524/hack-skeleton-app`
- Owner: `kevin36524`
- Repo: `hack-skeleton-app`
- May need to set up Cloud Build GitHub App connection first

### Environment Variables to Pass
```typescript
const envVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
};
```

### Error Handling
- Branch not found
- Build failures (compilation errors, etc.)
- Deployment failures (quota, permissions, etc.)
- GitHub connection issues
- Stream all errors back to client via SSE

### Testing Plan
1. Test with existing branch (e.g., `e2b/cloud-func-test`)
2. Test with main branch
3. Test with invalid branch name
4. Verify service URL is accessible after deployment
5. Verify environment variables are set correctly

### Benefits of SDK Approach
✅ No gcloud CLI required in Docker image
✅ No PATH issues
✅ Smaller Docker image
✅ Better error handling
✅ TypeScript types included
✅ More programmatic control

### Documentation References
- Cloud Build Node.js Client: https://googleapis.dev/nodejs/cloudbuild/latest/
- Cloud Run Node.js Client: https://googleapis.dev/nodejs/run/latest/
- @google-cloud/cloudbuild npm: https://www.npmjs.com/package/@google-cloud/cloudbuild
- @google-cloud/run npm: https://www.npmjs.com/package/@google-cloud/run

## Implementation Checklist
- [ ] Install SDK packages
- [ ] Update `/lib/cloudrun-deploy.ts` with SDK functions
- [ ] Update `/app/api/deploy-cloudrun/route.ts` to use new SDK functions
- [ ] Remove gcloud CLI from Dockerfile (revert to alpine or keep slim)
- [ ] Test locally if possible (may need service account key)
- [ ] Deploy and test with real branch
- [ ] Verify streaming progress works
- [ ] Handle all error cases
