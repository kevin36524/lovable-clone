"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface GenerateNavbarProps {
  sandboxId: string | null;
  previewUrl: string | null;
  showMastra: boolean;
  onToggleMastra: () => void;
  onShowGitModal: () => void;
  onShowCloudRunModal: () => void;
  sidebarSection: "claude" | "kimi";
  onToggleSidebarSection: () => void;
  onShowChat: () => void;
  showMobileChat: boolean;
  onShowPreview: () => void;
}

export default function GenerateNavbar({
  sandboxId,
  previewUrl,
  showMastra,
  onToggleMastra,
  onShowGitModal,
  onShowCloudRunModal,
  sidebarSection,
  onToggleSidebarSection,
  onShowChat,
  showMobileChat,
  onShowPreview,
}: GenerateNavbarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isKilling, setIsKilling] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleKillSandbox = async () => {
    if (!sandboxId || isKilling) return;
    const confirmed = confirm("Are you sure you want to kill this sandbox? This action cannot be undone.");
    if (!confirmed) return;

    setIsKilling(true);
    setShowMobileMenu(false);
    try {
      const response = await fetch("/api/kill-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId }),
      });
      if (!response.ok) throw new Error("Failed to kill sandbox");
      alert("Sandbox killed successfully");
      router.push("/");
    } catch (error: any) {
      console.error("Error killing sandbox:", error);
      alert("Failed to kill sandbox: " + error.message);
    } finally {
      setIsKilling(false);
    }
  };

  const currentUrl = previewUrl
    ? showMastra
      ? previewUrl.replace(/3000-/, "4111-")
      : previewUrl
    : null;

  const handleLaunchInNewTab = () => {
    if (!currentUrl) return;
    window.open(currentUrl, "_blank");
    setShowMobileMenu(false);
  };

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-gray-800">
        {/* Left: Hamburger (mobile) + User info */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger - left side */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors -ml-2"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {user ? (
            <>
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {user.name[0].toUpperCase()}
                </div>
              )}
              <span className="text-white text-sm font-medium truncate max-w-[120px]">{user.name}</span>
            </>
          ) : (
            <a href="/" className="flex items-center gap-2 text-white text-sm font-medium">
              <span className="inline-block w-6 h-6 rounded-sm bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500" />
              Vibatic
            </a>
          )}
        </div>

        {/* Right: Desktop action buttons */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onShowGitModal}
            disabled={!sandboxId}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save to Git
          </button>
          <button
            onClick={onShowCloudRunModal}
            disabled={!sandboxId}
            className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deploy to Cloud Run
          </button>
          <button
            onClick={handleKillSandbox}
            disabled={!sandboxId || isKilling}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isKilling ? "Killing..." : "Kill Sandbox"}
          </button>
          <button
            onClick={onToggleMastra}
            disabled={!previewUrl}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showMastra ? "Switch to Main App" : "Switch to Mastra"}
          </button>
          <button
            onClick={handleLaunchInNewTab}
            disabled={!currentUrl}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Launch in New Tab
          </button>
        </div>

      </nav>

      {/* Mobile slide-in drawer */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-gray-900 border-r border-gray-800 z-50 flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
              <span className="text-white font-semibold">Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button
                onClick={() => { onShowGitModal(); setShowMobileMenu(false); }}
                disabled={!sandboxId}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save to Git
              </button>

              <button
                onClick={() => { onShowCloudRunModal(); setShowMobileMenu(false); }}
                disabled={!sandboxId}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                Deploy to Cloud Run
              </button>

              <button
                onClick={handleKillSandbox}
                disabled={!sandboxId || isKilling}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isKilling ? "Killing..." : "Kill Sandbox"}
              </button>

              <button
                onClick={() => { onToggleMastra(); setShowMobileMenu(false); }}
                disabled={!previewUrl}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {showMastra ? "Switch to Main App" : "Switch to Mastra"}
              </button>

              <button
                onClick={handleLaunchInNewTab}
                disabled={!currentUrl}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Launch in New Tab
              </button>

              {showMobileChat ? (
                <button
                  onClick={() => { onShowPreview(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl font-medium transition-colors"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Show Preview
                </button>
              ) : (
                <button
                  onClick={() => { onShowChat(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-xl font-medium transition-colors"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modify with AI
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
