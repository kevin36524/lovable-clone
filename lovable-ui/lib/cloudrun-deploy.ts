import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { ServicesClient } from '@google-cloud/run';

// Branch name validation regex
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9/_-]+$/;

// Configuration constants
const PROJECT_ID = 'twiliotest-8d802';
const REGION = 'us-central1';
const SERVICE_ACCOUNT = 'calproxy-service-account@twiliotest-8d802.iam.gserviceaccount.com';
const REPO_OWNER = 'kevin36524';
const REPO_NAME = 'hack-skeleton-app';
const GITHUB_REPO_CONNECTION = 'github_kevin36524_hack-skeleton-app';

/**
 * Sanitize branch name for use as Cloud Run service name
 * - Replaces "/" with "_"
 * - Converts to lowercase
 * - Validates format
 */
export function sanitizeServiceName(branchName: string): string {
  if (!BRANCH_NAME_REGEX.test(branchName)) {
    throw new Error("Invalid branch name format. Only alphanumeric, hyphens, slashes, and underscores are allowed.");
  }

  return branchName.replace(/\//g, "_").toLowerCase();
}

/**
 * Validate branch name format
 */
export function validateBranchName(branchName: string): boolean {
  return BRANCH_NAME_REGEX.test(branchName);
}

/**
 * Build environment variable object for Cloud Run
 */
export function buildEnvVarObject(): Record<string, string> {
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY'
  ];

  const envVars: Record<string, string> = {};

  keys.forEach(key => {
    if (process.env[key]) {
      envVars[key] = process.env[key]!;
    }
  });

  if (Object.keys(envVars).length === 0) {
    throw new Error("No environment variables found. Please ensure required env vars are set.");
  }

  return envVars;
}

/**
 * Build Docker image from GitHub repository using Cloud Build
 */
export async function buildFromGitHub(
  branchName: string,
  onProgress: (message: string) => void
): Promise<string> {
  const buildClient = new CloudBuildClient();
  const serviceName = sanitizeServiceName(branchName);
  const imageUri = `gcr.io/${PROJECT_ID}/${REPO_NAME}:${serviceName}`;

  onProgress(`Building image from GitHub branch: ${branchName}`);
  onProgress(`Target image: ${imageUri}`);

  try {
    // Create build configuration using direct GitHub URL (works for public repos)
    const build = {
      source: {
        storageSource: undefined,
        repoSource: undefined,
        gitSource: {
          url: `https://github.com/${REPO_OWNER}/${REPO_NAME}.git`,
          revision: `refs/heads/${branchName}`,
        }
      },
      steps: [
        {
          name: 'gcr.io/cloud-builders/docker',
          args: ['build', '-t', imageUri, '.']
        }
      ],
      images: [imageUri],
      timeout: {
        seconds: 1200, // 20 minutes
      },
    };

    onProgress('Submitting build to Cloud Build...');

    // Start the build
    const [operation] = await buildClient.createBuild({
      projectId: PROJECT_ID,
      build: build,
    });

    onProgress(`Build submitted. Operation: ${operation.name}`);

    // Wait for the build to complete
    onProgress('Waiting for build to complete...');
    const [buildResult] = await operation.promise();

    // Cloud Build status codes: 0=UNKNOWN, 1=QUEUED, 2=WORKING, 3=SUCCESS, 4=FAILURE, 5=INTERNAL_ERROR, 6=TIMEOUT, 7=CANCELLED, 8=EXPIRED
    const statusCode = typeof buildResult.status === 'number' ? buildResult.status : buildResult.status === 'SUCCESS' ? 3 : 0;

    if (statusCode === 3 || buildResult.status === 'SUCCESS') {
      onProgress(`Build completed successfully!`);
      onProgress(`Image: ${imageUri}`);
      return imageUri;
    } else {
      throw new Error(`Build failed with status: ${buildResult.status} (code: ${statusCode})`);
    }

  } catch (error: any) {
    onProgress(`Build error: ${error.message}`);
    throw new Error(`Failed to build image: ${error.message}`);
  }
}

/**
 * Deploy image to Cloud Run using Cloud Run SDK
 */
export async function deployToCloudRunSDK(
  serviceName: string,
  imageUri: string,
  envVars: Record<string, string>,
  onProgress: (message: string) => void
): Promise<{ serviceUrl: string }> {
  const runClient = new ServicesClient();

  onProgress(`Deploying service: ${serviceName}`);
  onProgress(`Image: ${imageUri}`);
  onProgress(`Region: ${REGION}`);

  try {
    const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
    const fullServiceName = `${parent}/services/${serviceName}`;

    // Convert env vars object to array format for Cloud Run API
    const envVarsArray = Object.entries(envVars).map(([name, value]) => ({
      name,
      value,
    }));

    onProgress(`Configuring service with ${envVarsArray.length} environment variables...`);

    // Check if service exists
    let serviceExists = false;
    try {
      await runClient.getService({ name: fullServiceName });
      serviceExists = true;
      onProgress('Updating existing service...');
    } catch (error: any) {
      if (error.code === 5) { // NOT_FOUND
        onProgress('Creating new service...');
      } else {
        throw error;
      }
    }

    // Build the base service configuration
    const baseServiceConfig = {
      template: {
        containers: [{
          image: imageUri,
          env: envVarsArray,
        }],
        serviceAccount: SERVICE_ACCOUNT,
      },
    };

    let operation;
    if (serviceExists) {
      // Update existing service - must include name field
      [operation] = await runClient.updateService({
        service: {
          name: fullServiceName,
          ...baseServiceConfig,
        },
      });
    } else {
      // Create new service - must NOT include name field
      [operation] = await runClient.createService({
        parent: parent,
        serviceId: serviceName,
        service: baseServiceConfig,
      });
    }

    onProgress('Deployment in progress...');

    // Wait for deployment to complete
    const [service] = await operation.promise();

    // Make service publicly accessible
    onProgress('Configuring service to allow unauthenticated access...');
    await runClient.setIamPolicy({
      resource: fullServiceName,
      policy: {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['allUsers'],
          },
        ],
      },
    });

    const serviceUrl = service.uri || '';

    if (!serviceUrl) {
      throw new Error('Service deployed but no URL was returned');
    }

    onProgress(`Service deployed successfully!`);
    onProgress(`URL: ${serviceUrl}`);

    return { serviceUrl };

  } catch (error: any) {
    onProgress(`Deployment error: ${error.message}`);
    throw new Error(`Failed to deploy to Cloud Run: ${error.message}`);
  }
}
