import { ChildProcess } from "child_process";

// Interface for E2B process handles
export interface E2BProcess {
  kill: (signal?: string) => Promise<void>;
  wait: () => Promise<{ code: number }>;
}

// Union type for tracked processes
export type TrackedProcess = ChildProcess | E2BProcess;

// Type guard to check if it's an E2B process
export function isE2BProcess(proc: TrackedProcess): proc is E2BProcess {
  return 'wait' in proc && typeof (proc as any).wait === 'function';
}

// Use globalThis to ensure the Map persists across HMR in development
// This is needed because Next.js can reload modules independently
declare global {
  var runningProcesses: Map<string, TrackedProcess> | undefined;
}

// Global process tracker for cancellation
// This needs to be in a shared module so both execute-command and cancel-execution can access it
export const runningProcesses = globalThis.runningProcesses || new Map<string, TrackedProcess>();

if (!globalThis.runningProcesses) {
  globalThis.runningProcesses = runningProcesses;
}
