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
}

export default function GenerateNavbar({
  sandboxId,
  previewUrl,
  showMastra,
  onToggleMastra,
  onShowGitModal,
  onShowCloudRunModal
}: GenerateNavbarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isKilling, setIsKilling] = useState(false);

  const handleKillSandbox = async () => {
    if (!sandboxId || isKilling) return;

    const confirmed = confirm("Are you sure you want to kill this sandbox? This action cannot be undone.");
    if (!confirmed) return;

    setIsKilling(true);
    try {
      const response = await fetch("/api/kill-sandbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sandboxId }),
      });

      if (!response.ok) {
        throw new Error("Failed to kill sandbox");
      }

      alert("Sandbox killed successfully");
      router.push("/");
    } catch (error: any) {
      console.error("Error killing sandbox:", error);
      alert("Failed to kill sandbox: " + error.message);
    } finally {
      setIsKilling(false);
    }
  };

  const handleSwitchUrl = () => {
    onToggleMastra();
  };

  // Compute current URL based on toggle state
  const currentUrl = previewUrl
    ? showMastra
      ? previewUrl.replace(/3000-/, "4111-")
      : previewUrl
    : null;

  const handleLaunchInNewTab = () => {
    if (!currentUrl) return;
    window.open(currentUrl, "_blank");
  };

  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-sm border-b border-gray-800">
      {/* Logo */}
      <a
        href="/"
        className="flex items-center gap-2 text-xl font-semibold text-white hover:opacity-90 transition-opacity"
      >
        <span className="inline-block w-6 h-6 rounded-sm bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500" />
        Hackable
      </a>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {/* User display */}
        {user && (
          <div className="flex items-center gap-2 text-gray-300 text-sm mr-2">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full" />
            )}
            <span className="hidden md:inline">{user.name}</span>
          </div>
        )}

        <button
          onClick={onShowGitModal}
          disabled={!sandboxId}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save to Git
        </button>

        <button
          onClick={onShowCloudRunModal}
          disabled={!sandboxId}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Deploy to Cloud Run
        </button>

        <button
          onClick={handleKillSandbox}
          disabled={!sandboxId || isKilling}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isKilling ? "Killing..." : "Kill Sandbox"}
        </button>

        <button
          onClick={handleSwitchUrl}
          disabled={!previewUrl}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {showMastra ? "Switch to Main App" : "Switch to Mastra"}
        </button>

        <button
          onClick={handleLaunchInNewTab}
          disabled={!currentUrl}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Launch in New Tab
        </button>
      </div>
    </nav>
  );
}
