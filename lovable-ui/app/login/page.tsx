'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/generate';

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
    <main className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
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

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition-colors duration-200"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
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
          Don't have access?{' '}
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
