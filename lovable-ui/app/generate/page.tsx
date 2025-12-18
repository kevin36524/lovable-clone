"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GenerateNavbar from "@/components/GenerateNavbar";

interface Message {
  type: "claude_message" | "tool_use" | "tool_result" | "progress" | "error" | "complete" | "session_id" | "request_id";
  content?: string;
  name?: string;
  input?: any;
  result?: any;
  message?: string;
  previewUrl?: string;
  sandboxId?: string;
  sessionId?: string;
  requestId?: string;
  serviceUrl?: string;
  serviceName?: string;
}

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateName = searchParams.get("templateName") || "";
  const gitBranch = searchParams.get("gitBranch") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [isQueryProcessing, setIsQueryProcessing] = useState(false);
  const [commandMode, setCommandMode] = useState<"shell" | "ai">("ai");
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [showMastra, setShowMastra] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showGitModal, setShowGitModal] = useState(false);
  const [gitBranchName, setGitBranchName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastGitBranchName") || "";
    }
    return "";
  });
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [isGitSaving, setIsGitSaving] = useState(false);
  const [showCloudRunModal, setShowCloudRunModal] = useState(false);
  const [cloudRunBranchName, setCloudRunBranchName] = useState("");
  const [isCloudRunDeploying, setIsCloudRunDeploying] = useState(false);
  const [cloudRunServiceUrl, setCloudRunServiceUrl] = useState<string | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const timeoutWarningShownRef = useRef(false);
  const sandboxCreationTimeRef = useRef<number | null>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Timeout warning effect - shows alert 5 minutes before 20-minute timeout
  useEffect(() => {
    if (sandboxId && !timeoutWarningShownRef.current) {
      // Record the sandbox creation time
      if (!sandboxCreationTimeRef.current) {
        sandboxCreationTimeRef.current = Date.now();
      }

      // Set timeout to show warning at 15 minutes (5 minutes before 20-minute expiry)
      const warningTime = 15 * 60 * 1000; // 15 minutes in milliseconds
      const timeElapsed = Date.now() - sandboxCreationTimeRef.current;
      const timeUntilWarning = warningTime - timeElapsed;

      if (timeUntilWarning > 0) {
        const warningTimer = setTimeout(() => {
          setShowTimeoutWarning(true);
          timeoutWarningShownRef.current = true;
        }, timeUntilWarning);

        return () => clearTimeout(warningTimer);
      }
    }
  }, [sandboxId]);
  
  useEffect(() => {
    // Check if we have template info
    if (!templateName) {
      router.push("/");
      return;
    }

    // Prevent double execution in StrictMode
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    setIsGenerating(true);
    deployE2BSandbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName, router]);
  
  const deployE2BSandbox = async () => {
    try {
      const response = await fetch("/api/deploy-e2b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateName, gitBranch }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to deploy sandbox");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              setIsGenerating(false);
              break;
            }

            try {
              const message = JSON.parse(data) as Message;

              if (message.type === "error") {
                throw new Error(message.message);
              } else if (message.type === "complete") {
                setPreviewUrl(message.previewUrl || null);
                setSandboxId(message.sandboxId || null);
                setIsGenerating(false);
              } else {
                setMessages((prev) => [...prev, message]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Error deploying sandbox:", err);
      setError(err.message || "An error occurred");
      setIsGenerating(false);
    }
  };

  const stopExecution = async () => {
    if (!currentRequestId) return;

    try {
      // Abort the fetch stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Call cancel API to kill the backend process
      await fetch("/api/cancel-execution", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: currentRequestId }),
      });

      setMessages((prev) => [...prev, {
        type: "error",
        message: "Execution stopped by user"
      }]);

      setIsQueryProcessing(false);
      setCurrentRequestId(null);
    } catch (err: any) {
      console.error("Error stopping execution:", err);
    }
  };

  const clearSessionId = () => {
    setSessionId(null);
    setMessages((prev) => [...prev, {
      type: "progress",
      message: "AI session cleared. Next command will start a new session."
    }]);
    console.log("AI session cleared");
  };

  const handleGitSave = async () => {
    if (!gitBranchName.trim() || !gitCommitMessage.trim() || !sandboxId) return;

    setIsGitSaving(true);
    const branchWithPrefix = `e2b/${gitBranchName.trim()}`;

    setMessages((prev) => [...prev, {
      type: "progress",
      message: `Saving to git: branch=${branchWithPrefix}, message="${gitCommitMessage}"`
    }]);

    try {
      const response = await fetch("/api/execute-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sandboxId,
          commandType: "shell",
          query: `./scripts/git_ops.sh commitAndPush ${branchWithPrefix} "${gitCommitMessage}"`
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute git save");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const message = JSON.parse(data) as Message;

              if (message.type === "error") {
                throw new Error(message.message);
              } else {
                setMessages((prev) => [...prev, message]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Save branch name to localStorage for future use
      if (typeof window !== "undefined") {
        localStorage.setItem("lastGitBranchName", gitBranchName.trim());
      }

      // Close modal and reset commit message only
      setShowGitModal(false);
      setGitCommitMessage("");
    } catch (err: any) {
      console.error("Error saving to git:", err);
      setMessages((prev) => [...prev, {
        type: "error",
        message: err.message || "Failed to save to git"
      }]);
    } finally {
      setIsGitSaving(false);
    }
  };

  const handleCloudRunDeploy = async () => {
    if (!cloudRunBranchName.trim()) return;

    setIsCloudRunDeploying(true);
    const branchName = cloudRunBranchName.trim();

    setMessages((prev) => [...prev, {
      type: "progress",
      message: `Starting Cloud Run deployment for branch: ${branchName}`
    }]);

    try {
      const response = await fetch("/api/deploy-cloudrun", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchName }),
      });

      if (!response.ok) {
        throw new Error("Failed to start Cloud Run deployment");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const message = JSON.parse(data) as Message;

              if (message.type === "error") {
                throw new Error(message.message);
              } else if (message.type === "complete") {
                setCloudRunServiceUrl(message.serviceUrl || null);
                setMessages((prev) => [...prev, {
                  type: "progress",
                  message: `✅ Deployed successfully! URL: ${message.serviceUrl}`
                }]);
              } else {
                setMessages((prev) => [...prev, message]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      setShowCloudRunModal(false);
      setCloudRunBranchName("");
    } catch (err: any) {
      console.error("Error deploying to Cloud Run:", err);
      setMessages((prev) => [...prev, {
        type: "error",
        message: err.message || "Failed to deploy to Cloud Run"
      }]);
    } finally {
      setIsCloudRunDeploying(false);
    }
  };

  const handleQuerySubmit = async () => {
    if (!userQuery.trim() || !sandboxId || isQueryProcessing) return;

    setIsQueryProcessing(true);
    const query = userQuery;
    setUserQuery("");

    // Add user message to chat
    setMessages((prev) => [...prev, {
      type: "claude_message",
      content: `User: ${query}`
    }]);

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      // Use the selected command mode
      // Include sessionId only for AI commands
      const requestBody: any = { sandboxId, commandType: commandMode, query };
      if (commandMode === "ai" && sessionId) {
        requestBody.sessionId = sessionId;
      }

      const response = await fetch("/api/execute-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to execute query");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const message = JSON.parse(data) as Message;

              if (message.type === "error") {
                throw new Error(message.message);
              } else if ((message as any).type === "request_id") {
                // Store the request ID for potential cancellation
                setCurrentRequestId((message as any).requestId);
              } else if (message.type === "session_id" && message.sessionId) {
                // Store the session ID for future AI requests
                setSessionId(message.sessionId);
                console.log("AI Session ID:", message.sessionId);
              } else {
                setMessages((prev) => [...prev, message]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      // Don't show error if it was manually aborted
      if (err.name !== "AbortError") {
        console.error("Error executing query:", err);
        setMessages((prev) => [...prev, {
          type: "error",
          message: err.message || "Failed to execute query"
        }]);
      }
    } finally {
      setIsQueryProcessing(false);
      setCurrentRequestId(null);
      abortControllerRef.current = null;
    }
  };
  
  const formatToolInput = (input: any) => {
    if (!input) return "";
    
    // Extract key information based on tool type
    if (input.file_path) {
      return `File: ${input.file_path}`;
    } else if (input.command) {
      return `Command: ${input.command}`;
    } else if (input.pattern) {
      return `Pattern: ${input.pattern}`;
    } else if (input.prompt) {
      return `Prompt: ${input.prompt.substring(0, 100)}...`;
    }
    
    // For other cases, show first meaningful field
    const keys = Object.keys(input);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const value = input[firstKey];
      if (typeof value === 'string' && value.length > 100) {
        return `${firstKey}: ${value.substring(0, 100)}...`;
      }
      return `${firstKey}: ${value}`;
    }
    
    return JSON.stringify(input).substring(0, 100) + "...";
  };

  // Compute current display URL based on toggle state
  const displayUrl = previewUrl && showMastra
    ? previewUrl.replace(/3000-/, "4111-")
    : previewUrl;

  return (
    <main className="h-screen bg-black flex flex-col overflow-hidden relative">
      <GenerateNavbar
        sandboxId={sandboxId}
        previewUrl={previewUrl}
        showMastra={showMastra}
        onToggleMastra={() => setShowMastra(!showMastra)}
      />
      {/* Spacer for navbar */}
      <div className="h-16" />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Chat */}
        <div className="w-[30%] flex flex-col border-r border-gray-800">
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Hackable</h2>
            <p className="text-gray-400 text-sm mt-1 break-words">
              {templateName ? `Template: ${templateName}` : "Setting up..."}
            </p>
            {sessionId && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-green-400 text-xs">AI Session Active</p>
              </div>
            )}
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overflow-x-hidden">
            {messages.map((message, index) => (
              <div key={index}>
                {message.type === "claude_message" && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">H</span>
                      </div>
                      <span className="text-white font-medium">Hackable</span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                )}
                
                {message.type === "tool_use" && (
                  <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 overflow-hidden">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 flex-shrink-0">🔧 {message.name}</span>
                      <span className="text-gray-500 break-all">{formatToolInput(message.input)}</span>
                    </div>
                  </div>
                )}
                
                {message.type === "progress" && (
                  <div className="text-gray-500 text-sm font-mono break-all">
                    {message.message}
                  </div>
                )}
              </div>
            ))}
            
            {isGenerating && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                <span>Working...</span>
              </div>
            )}
            
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Bottom input area */}
          <div className="p-4 border-t border-gray-800">
            {/* Mode switcher */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setCommandMode("ai")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  commandMode === "ai"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                AI Mode
              </button>
              <button
                onClick={() => setCommandMode("shell")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  commandMode === "shell"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                Shell Mode
              </button>
              <button
                onClick={clearSessionId}
                disabled={!sessionId}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={sessionId ? "Clear AI session and start fresh" : "No active session"}
              >
                Clear AI Session
              </button>
              <button
                onClick={() => setShowGitModal(true)}
                disabled={!sandboxId}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={sandboxId ? "Save changes to git" : "Waiting for sandbox"}
              >
                Save to Git
              </button>
              <button
                onClick={() => setShowCloudRunModal(true)}
                disabled={!sandboxId}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-700 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={sandboxId ? "Deploy to Cloud Run" : "Waiting for sandbox"}
              >
                Deploy to Cloud Run
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  !previewUrl
                    ? "Waiting for sandbox..."
                    : commandMode === "ai"
                    ? "Ask Claude to modify your app..."
                    : "Enter shell command (e.g., ls, npm run dev)..."
                }
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleQuerySubmit();
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-800 focus:outline-none focus:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!previewUrl || isQueryProcessing}
              />
              {isQueryProcessing && currentRequestId ? (
                <button
                  onClick={stopExecution}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
                  title="Stop execution"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleQuerySubmit}
                  disabled={!previewUrl || !userQuery.trim() || isQueryProcessing}
                  className="p-2 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side - Preview */}
        <div className="w-[70%] bg-gray-950 flex items-center justify-center">
          {!displayUrl && isGenerating && (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gray-700 rounded-xl animate-pulse"></div>
              </div>
              <p className="text-gray-400">Spinning up preview...</p>
            </div>
          )}

          {displayUrl && (
            <iframe
              key={displayUrl}
              src={displayUrl}
              className="w-full h-full"
              title="Website Preview"
            />
          )}

          {!displayUrl && !isGenerating && (
            <div className="text-center">
              <p className="text-gray-400">Preview will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Git Save Modal */}
      {showGitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-[500px] border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-4">Save to Git</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Branch Name
                  <span className="text-gray-600 ml-2">(e2b/ prefix will be added)</span>
                </label>
                <input
                  type="text"
                  placeholder="feature-name"
                  value={gitBranchName}
                  onChange={(e) => setGitBranchName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
                  disabled={isGitSaving}
                />
                {gitBranchName && (
                  <p className="text-gray-500 text-xs mt-1">
                    Will create: e2b/{gitBranchName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Commit Message
                </label>
                <textarea
                  placeholder="Describe your changes..."
                  value={gitCommitMessage}
                  onChange={(e) => setGitCommitMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600 resize-none"
                  disabled={isGitSaving}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowGitModal(false);
                  setGitCommitMessage("");
                }}
                disabled={isGitSaving}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleGitSave}
                disabled={!gitBranchName.trim() || !gitCommitMessage.trim() || isGitSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGitSaving ? "Saving..." : "Save to Git"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Run Deploy Modal */}
      {showCloudRunModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-[500px] border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-4">Deploy to Cloud Run</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Branch Name
                  <span className="text-gray-600 ml-2">(e.g., e2b/feature-name or main)</span>
                </label>
                <input
                  type="text"
                  placeholder="e2b/feature-name"
                  value={cloudRunBranchName}
                  onChange={(e) => setCloudRunBranchName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
                  disabled={isCloudRunDeploying}
                />
                <p className="text-gray-500 text-xs mt-1">
                  Service name will be: {cloudRunBranchName ? cloudRunBranchName.replace(/\//g, "_") : "(auto-generated)"}
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3 text-xs">
                <p className="text-gray-400 mb-2">This will:</p>
                <ul className="text-gray-500 space-y-1 list-disc list-inside">
                  <li>Clone the specified branch from GitHub</li>
                  <li>Deploy to Google Cloud Run (us-central1)</li>
                  <li>Configure environment variables automatically</li>
                  <li>Process takes ~3-5 minutes</li>
                </ul>
              </div>

              {cloudRunServiceUrl && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <p className="text-green-400 text-sm mb-1">Last Deployment:</p>
                  <a
                    href={cloudRunServiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm break-all underline"
                  >
                    {cloudRunServiceUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCloudRunModal(false);
                  setCloudRunBranchName("");
                }}
                disabled={isCloudRunDeploying}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCloudRunDeploy}
                disabled={!cloudRunBranchName.trim() || isCloudRunDeploying}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCloudRunDeploying ? "Deploying..." : "Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-orange-900/90 to-red-900/90 rounded-lg p-6 w-[500px] border-2 border-orange-500 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold">Sandbox Expiring Soon!</h3>
            </div>

            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <p className="text-white text-base mb-3">
                Your sandbox will expire in approximately <span className="font-bold text-orange-300">5 minutes</span>.
              </p>
              <p className="text-orange-200 text-sm">
                Please save your work to Git now to avoid losing your changes!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTimeoutWarning(false)}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Remind Me Later
              </button>
              <button
                onClick={() => {
                  setShowTimeoutWarning(false);
                  setShowGitModal(true);
                }}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-bold shadow-lg"
              >
                Save to Git Now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <GeneratePageContent />
    </Suspense>
  );
}