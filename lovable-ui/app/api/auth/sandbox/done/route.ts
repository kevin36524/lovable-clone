import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth Completion Page for Sandbox Applications
 *
 * GET /api/auth/sandbox/done?access_token=...&refresh_token=...&expires_in=...&email=...&name=...&picture=...
 *
 * Renders HTML page that sends OAuth tokens back to the sandbox application
 * via window.postMessage and auto-closes the popup after 1 second.
 *
 * Query Parameters:
 * - access_token: Google access token (required)
 * - refresh_token: Google refresh token (optional)
 * - expires_in: Token expiration timestamp (required)
 * - email: User email (required)
 * - name: User name (optional)
 * - picture: User picture URL (optional)
 * - error: Error code if OAuth failed (optional)
 *
 * postMessage Format:
 * {
 *   type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR',
 *   data: {...tokens and user info} | error: string
 * }
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Extract all parameters from URL
  const access_token = searchParams.get('access_token');
  const refresh_token = searchParams.get('refresh_token');
  const expires_in = searchParams.get('expires_in');
  const email = searchParams.get('email');
  const name = searchParams.get('name');
  const picture = searchParams.get('picture');
  const error = searchParams.get('error');
  const returnUrl = searchParams.get('returnUrl');

  // Build postMessage data object
  const hasError = !!error;
  const messageData = hasError
    ? { type: 'OAUTH_ERROR', error }
    : {
        type: 'OAUTH_SUCCESS',
        data: {
          access_token,
          refresh_token,
          expires_in: expires_in ? parseInt(expires_in) : null,
          email,
          name,
          picture,
          timestamp: Date.now(),
        },
      };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication ${hasError ? 'Failed' : 'Complete'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: ${hasError ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
      color: white;
      padding: 2rem;
    }

    .container {
      text-align: center;
      max-width: 400px;
      animation: fadeIn 0.3s ease-in-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      animation: ${hasError ? 'shake 0.5s ease-in-out' : 'checkmark 0.5s ease-in-out'};
    }

    @keyframes checkmark {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.2);
      }
    }

    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      25% {
        transform: translateX(-10px);
      }
      75% {
        transform: translateX(10px);
      }
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    p {
      font-size: 1rem;
      opacity: 0.9;
      line-height: 1.5;
    }

    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
      margin-left: 0.5rem;
      vertical-align: middle;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${hasError ? '⚠️' : '✓'}</div>
    <h1>Authentication ${hasError ? 'Failed' : 'Complete'}</h1>
    <p>
      ${hasError ? 'An error occurred during authentication.' : 'Sending credentials to your application'}
      <span class="spinner"></span>
    </p>
  </div>

  <script>
    (function() {
      // postMessage data
      const messageData = ${JSON.stringify(messageData)};
      const returnUrl = ${JSON.stringify(returnUrl)};

      // Check if this is a popup or same-window navigation
      if (window.opener) {
        // Popup mode: Send postMessage and close
        try {
          // Send to all origins (required for dynamic sandbox URLs)
          window.opener.postMessage(messageData, '*');
          console.log('[OAuth Bridge] postMessage sent successfully');
        } catch (error) {
          console.error('[OAuth Bridge] Failed to send postMessage:', error);
        }

        // Auto-close popup after 1 second
        setTimeout(function() {
          try {
            window.close();
          } catch (error) {
            console.warn('[OAuth Bridge] Failed to close window automatically');
          }
        }, 1000);
      } else if (returnUrl) {
        // Same-window mode: Redirect back to returnUrl with tokens in hash
        try {
          const url = new URL(returnUrl);

          // Encode tokens as JSON in URL hash
          const tokenData = messageData.type === 'OAUTH_SUCCESS'
            ? messageData.data
            : { error: messageData.error };

          url.hash = 'oauth_' + encodeURIComponent(JSON.stringify(tokenData));

          console.log('[OAuth Bridge] Redirecting back to:', url.toString());
          window.location.href = url.toString();
        } catch (error) {
          console.error('[OAuth Bridge] Failed to redirect:', error);
        }
      } else {
        console.warn('[OAuth Bridge] No window.opener or returnUrl found');
      }
    })();
  </script>
</body>
</html>
  `.trim();

  // Return HTML response
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline';",
    },
  });
}
