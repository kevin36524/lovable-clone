"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function Home() {
  const router = useRouter();
  const [showGitBranchModal, setShowGitBranchModal] = useState(false);
  const [gitBranchInput, setGitBranchInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastGitBranchName") || "";
    }
    return "";
  });
  const [selectedBaseTemplate, setSelectedBaseTemplate] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastSelectedBaseTemplate") || "app-with-uds-mail-mastra";
    }
    return "app-with-uds-mail-mastra";
  });

  const handleTemplateSelection = (templateName: string, gitBranch?: string) => {
    const params = new URLSearchParams({
      templateName,
      ...(gitBranch && { gitBranch })
    });
    router.push(`/generate?${params.toString()}`);
  };

  const handleGitBranchSubmit = () => {
    if (!gitBranchInput.trim()) return;

    const branchWithPrefix = `e2b/${gitBranchInput.trim()}`;

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("lastGitBranchName", gitBranchInput.trim());
      localStorage.setItem("lastSelectedBaseTemplate", selectedBaseTemplate);
    }

    const params = new URLSearchParams({
      templateName: selectedBaseTemplate,
      gitBranch: branchWithPrefix
    });
    router.push(`/generate?${params.toString()}`);
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-black">
      {/* Navbar */}
      <Navbar />

      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/gradient.png')" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-24 pb-8 min-h-screen px-4 sm:px-6 lg:px-8 sm:justify-center sm:pt-0">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <h1 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
            Build something with Vibatic
          </h1>
          <h3 className="text-lg sm:text-xl text-gray-300 mb-6 sm:mb-12 max-w-2xl mx-auto">
            Build with ❤️ by X-Team
          </h3>

          <p className="text-lg sm:text-xl text-gray-300 mb-8 sm:mb-12 max-w-2xl mx-auto">
            Choose a template to start building your application
          </p>

          {/* Template Selection Buttons */}
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {/* App with Mastra */}
              <button
                onClick={() => handleTemplateSelection('app-with-mastra')}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-blue-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">App with Mastra</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Next.js app with Mastra AI integration</p>
                </div>
              </button>

              {/* App with Mail and Mastra */}
              <button
                onClick={() => handleTemplateSelection('app-with-mail-mastra')}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-green-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">App with Mail & Mastra</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Full-featured app with email and AI</p>
                </div>
              </button>

              {/* App with UDS Mail */}
              <button
                onClick={() => handleTemplateSelection('app-with-uds-mail-mastra')}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-purple-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">App with UDS Mail</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">UDS Mail integration with Mastra</p>
                </div>
              </button>

              {/* App with Gmail */}
              <button
                onClick={() => handleTemplateSelection('app-with-gmail-mastra')}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-red-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">App with Gmail</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Gmail integration with Mastra</p>
                </div>
              </button>

              {/* App with Home */}
              <button
                onClick={() => handleTemplateSelection('app-with-yahoo-home-mastra')}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-yellow-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">App with Home</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Yahoo Home integration with Mastra</p>
                </div>
              </button>

              {/* From Git Branch */}
              <button
                onClick={() => setShowGitBranchModal(true)}
                className="group relative p-4 sm:p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-600/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-orange-600/30 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-xl font-semibold text-white mb-1 sm:mb-2">From Git Branch</h3>
                  <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">Load from a specific Git branch</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Git Branch Modal */}
      {showGitBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-[calc(100vw-2rem)] max-w-[500px] border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-4">Load from Git Branch</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Base Template
                </label>
                <select
                  value={selectedBaseTemplate}
                  onChange={(e) => setSelectedBaseTemplate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
                >
                  <option value="app-with-mastra">App With Mastra</option>
                  <option value="app-with-mail-mastra">App with Mail and Mastra</option>
                  <option value="app-with-uds-mail-mastra">App with UDS Mail</option>
                  <option value="app-with-gmail-mastra">App with Gmail</option>
                  <option value="app-with-yahoo-home-mastra">App with Home</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Branch Name
                  <span className="text-gray-600 ml-2">(e2b/ prefix will be added)</span>
                </label>
                <input
                  type="text"
                  placeholder="feature-name"
                  value={gitBranchInput}
                  onChange={(e) => setGitBranchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && gitBranchInput.trim()) {
                      handleGitBranchSubmit();
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
                  autoFocus
                />
                {gitBranchInput && (
                  <p className="text-gray-500 text-xs mt-1">
                    Will load from: e2b/{gitBranchInput}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGitBranchModal(false)}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGitBranchSubmit}
                disabled={!gitBranchInput.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Load Branch
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </main>
  );
}
