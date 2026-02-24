'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/generate';
  const [agreed, setAgreed] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/signin/google?redirect=${encodeURIComponent(redirect)}`;
  };

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'invalid_state':
        return 'Invalid session. Please try again.';
      case 'unauthorized_domain':
        return 'Your email domain is not authorized to access this application.';
      case 'oauth_failed':
        return 'Authentication failed. Please try again.';
      case 'missing_code':
        return 'Authorization code missing. Please try again.';
      default:
        return errorCode ? `Authentication error: ${errorCode}` : null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden py-12">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-orange-500/20 via-pink-500/20 to-blue-500/20 rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 text-2xl font-semibold text-white">
              <span className="inline-block w-8 h-8 rounded-sm bg-gradient-to-br from-orange-400 via-pink-500 to-blue-500" />
              Hackable
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Welcome back
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Sign in to continue to Hackable
          </p>

          {/* Error message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm text-center">{errorMessage}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mb-6 p-4 bg-gray-800/60 border border-gray-700 rounded-xl">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
              Important Notice — Pending Paranoid Approval
            </p>
            <div className="space-y-2 text-gray-300 text-xs font-semibold leading-relaxed">
              <p>
                <span className="text-white">Infrastructure:</span> This platform operates on personal, non-corporate infrastructure utilizing Kimi coding agent, E2B sandboxes, and Google Cloud Run (GCP).
              </p>
              <p>
                <span className="text-white">Data Sharing:</span> Any application built on this platform that incorporates a large language model (LLM) will transmit data to third-party LLM providers, including but not limited to OpenAI, Google, Anthropic, Kimi, and Groq.
              </p>
              <p>
                <span className="text-white">Data Persistence:</span> To maintain conversational context, applications built on this platform may utilize Supabase for data storage.
              </p>
              <p className="text-amber-300/90">
                <span className="text-amber-200">Liability:</span> The platform operators assume no liability for data loss, security incidents, defects, or any other issues arising from its use. The individual who creates an application using this platform bears sole responsibility for any consequences resulting from that software.
              </p>
            </div>
          </div>

          {/* Acknowledgement checkbox */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${agreed ? 'bg-orange-500 border-orange-500' : 'bg-transparent border-gray-600 group-hover:border-gray-400'}`}>
                {agreed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-xs font-semibold leading-relaxed group-hover:text-gray-300 transition-colors">
              I have read and understood the above notice. I acknowledge the data sharing and liability terms described herein.
            </span>
          </label>

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleLogin}
            disabled={!agreed}
            className={`w-full flex items-center justify-center gap-3 px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
              agreed
                ? 'bg-white hover:bg-gray-100 text-gray-900 cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
            }`}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill={agreed ? '#4285F4' : '#6B7280'}
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill={agreed ? '#34A853' : '#6B7280'}
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill={agreed ? '#FBBC05' : '#6B7280'}
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill={agreed ? '#EA4335' : '#6B7280'}
              />
            </svg>
            Continue with Google
          </button>

          {/* Footer text */}
          <p className="text-gray-500 text-xs text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Additional info */}
        <p className="text-gray-600 text-sm text-center mt-6">
          Don&apos;t have access?{' '}
          <a href="mailto:support@hackable.com" className="text-blue-400 hover:text-blue-300">
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-white rounded-full animate-spin" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
