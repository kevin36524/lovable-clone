"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function Home() {
  const router = useRouter();

  const handleTemplateSelection = (templateName: string, gitBranch?: string) => {
    const params = new URLSearchParams({
      templateName,
      ...(gitBranch && { gitBranch })
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
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <h1 className="text-4xl sm:text-4xl md:text-4xl font-bold text-white mb-6">
            Build something with Hackable
          </h1>
          <h3 className="text-xl sm:text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            BUILT WITH CLAUDE CODE
          </h3>

          <p className="text-xl sm:text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Choose a template to start building your application
          </p>

          {/* Template Selection Buttons */}
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Blank App */}
              <button
                onClick={() => handleTemplateSelection('blank-app')}
                className="group relative p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
                    <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Blank App</h3>
                  <p className="text-gray-400 text-sm">Start with a clean Next.js application</p>
                </div>
              </button>

              {/* App with Mastra */}
              <button
                onClick={() => handleTemplateSelection('app-with-mastra')}
                className="group relative p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">App with Mastra</h3>
                  <p className="text-gray-400 text-sm">Next.js app with Mastra AI integration</p>
                </div>
              </button>

              {/* App with Mail and Mastra */}
              <button
                onClick={() => handleTemplateSelection('app-with-mail-mastra')}
                className="group relative p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-green-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-600/30 transition-colors">
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">App with Mail & Mastra</h3>
                  <p className="text-gray-400 text-sm">Full-featured app with email and AI</p>
                </div>
              </button>

              {/* Joke App */}
              <button
                onClick={() => handleTemplateSelection('hack-skeleton-joke')}
                className="group relative p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-yellow-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-yellow-600/30 transition-colors">
                    <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Joke App</h3>
                  <p className="text-gray-400 text-sm">Fun skeleton joke application</p>
                </div>
              </button>

              {/* From Git Branch */}
              <button
                onClick={() => handleTemplateSelection('from-git-branch', 'main')}
                className="group relative p-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-600/30 transition-colors">
                    <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">From Git Branch</h3>
                  <p className="text-gray-400 text-sm">Load from a specific Git branch</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

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
