import { ChildProcess } from "child_process";

// Use globalThis to ensure the Map persists across HMR in development
// This is needed because Next.js can reload modules independently
declare global {
  var runningProcesses: Map<string, ChildProcess> | undefined;
}

// Global process tracker for cancellation
// This needs to be in a shared module so both execute-command and cancel-execution can access it
export const runningProcesses = globalThis.runningProcesses || new Map<string, ChildProcess>();

if (!globalThis.runningProcesses) {
  globalThis.runningProcesses = runningProcesses;
}
