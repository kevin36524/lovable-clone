# OAuth Bridge Integration Guide

## Overview

The OAuth Bridge is a stateless authentication service that enables sandbox applications to access Gmail and Calendar APIs via Google OAuth 2.0. Since Google OAuth requires static redirect URIs and sandbox applications have dynamic URLs, this bridge acts as a secure intermediary.

**Key Features:**
- ✅ Stateless design - tokens never stored on server
- ✅ Read-only Gmail and Calendar access
- ✅ Popup or same-window OAuth flow
- ✅ Token refresh and validation endpoints
- ✅ CORS enabled for dynamic sandbox URLs
- ✅ Rate limiting: 100 requests per 15 minutes

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://hack.oath.email` |
| **Local Development** | `http://localhost:3000` |

---

## Available Endpoints

### 1. OAuth Flow Endpoints

#### **Start OAuth Flow**
```
GET /api/auth/sandbox/start?returnUrl=<your-sandbox-url>
```

**Description:** Initiates the OAuth flow and redirects user to Google consent screen.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnUrl` | string | Yes | Your sandbox URL to receive tokens after authentication |

**Example:**
```javascript
const returnUrl = encodeURIComponent('https://your-sandbox.example.com');
window.location.href = `https://hack.oath.email/api/auth/sandbox/start?returnUrl=${returnUrl}`;
```

---

#### **OAuth Callback** (Google redirects here)
```
GET /api/auth/sandbox/callback/google
```

**Description:** Handles Google OAuth callback. **You don't call this directly** - Google redirects here automatically.

---

#### **OAuth Completion Page**
```
GET /api/auth/sandbox/done
```

**Description:** Final step that sends tokens back to your sandbox via `postMessage` or URL redirect.

**Token Delivery Methods:**

**A. Popup Mode** (if opened with `window.open`):
```javascript
// Tokens sent via postMessage
{
  type: 'OAUTH_SUCCESS',
  data: {
    access_token: string,
    refresh_token: string,
    expires_in: number,      // Unix timestamp
    email: string,
    name: string,
    picture: string,
    timestamp: number
  }
}
```

**B. Same-Window Mode** (if navigated directly):
Redirects back to `returnUrl` with tokens in URL hash:
```
https://your-sandbox.example.com#oauth_{...tokenData}
```

---

### 2. Token Management Endpoints

#### **Refresh Access Token**
```
POST /api/token/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

**Description:** Exchanges a refresh token for a new access token.

**Response (200 OK):**
```json
{
  "access_token": "ya29.a0AfH6...",
  "expires_in": 1707600000,
  "token_type": "Bearer",
  "refresh_token": "1//0gF..." // (optional, if Google returns new one)
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Failed to refresh token",
  "message": "Please re-authenticate",
  "code": "REFRESH_FAILED"
}
```

---

#### **Validate Access Token**
```
POST /api/token/validate
Content-Type: application/json

{
  "access_token": "your-access-token"
}
```

**Description:** Validates an access token and returns user information.

**Response (200 OK) - Valid Token:**
```json
{
  "valid": true,
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "verified_email": true
}
```

**Response (200 OK) - Invalid Token:**
```json
{
  "valid": false
}
```

---

### 3. Health Check

#### **Service Health**
```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T12:34:56.789Z",
  "stateless": true,
  "tokenStorage": "none",
  "service": "oauth-bridge"
}
```

---

## OAuth Scopes

The OAuth bridge requests the following Google API scopes:

| Scope | Description |
|-------|-------------|
| `gmail.readonly` | Read Gmail messages and metadata |
| `calendar.readonly` | Read calendar events and settings |
| `userinfo.email` | Access user's email address |
| `userinfo.profile` | Access user's basic profile info |

---

## Integration Guide

### Method 1: Popup Flow (Recommended)

**Step 1:** Open OAuth flow in a popup window

```javascript
// Store this function in your sandbox app
function connectGmail() {
  const returnUrl = window.location.href;
  const oauthUrl = `https://hack.oath.email/api/auth/sandbox/start?returnUrl=${encodeURIComponent(returnUrl)}`;

  // Open popup
  const popup = window.open(
    oauthUrl,
    'gmail-oauth',
    'width=600,height=700,left=100,top=100'
  );

  if (!popup) {
    alert('Please allow popups for this site');
  }
}
```

**Step 2:** Listen for tokens via postMessage

```javascript
// Listen for OAuth success message
window.addEventListener('message', (event) => {
  // Security: Verify origin in production
  // if (event.origin !== 'https://hack.oath.email') return;

  if (event.data.type === 'OAUTH_SUCCESS') {
    const tokens = event.data.data;

    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Expires At:', new Date(tokens.expires_in * 1000));
    console.log('User Email:', tokens.email);

    // Store tokens (use secure storage in production)
    localStorage.setItem('gmail_tokens', JSON.stringify(tokens));

    // Now you can call Gmail API
    fetchEmails(tokens.access_token);
  } else if (event.data.type === 'OAUTH_ERROR') {
    console.error('OAuth failed:', event.data.error);
    alert('Authentication failed: ' + event.data.error);
  }
});
```

**Step 3:** Use the access token to call Gmail API

```javascript
async function fetchEmails(accessToken) {
  const response = await fetch(
    'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, refresh it
      await refreshAccessToken();
      return;
    }
    throw new Error('Failed to fetch emails');
  }

  const data = await response.json();
  console.log('Emails:', data.messages);
}
```

**Step 4:** Refresh expired tokens

```javascript
async function refreshAccessToken() {
  const tokens = JSON.parse(localStorage.getItem('gmail_tokens'));

  if (!tokens.refresh_token) {
    console.error('No refresh token available');
    // Need to re-authenticate
    connectGmail();
    return null;
  }

  const response = await fetch('https://hack.oath.email/api/token/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token
    })
  });

  if (!response.ok) {
    console.error('Token refresh failed');
    // Need to re-authenticate
    connectGmail();
    return null;
  }

  const newTokens = await response.json();

  // Update stored tokens
  tokens.access_token = newTokens.access_token;
  tokens.expires_in = newTokens.expires_in;
  if (newTokens.refresh_token) {
    tokens.refresh_token = newTokens.refresh_token;
  }

  localStorage.setItem('gmail_tokens', JSON.stringify(tokens));
  console.log('Token refreshed successfully');

  return newTokens.access_token;
}
```

---

### Method 2: Same-Window Flow

**Step 1:** Navigate to OAuth URL

```javascript
function connectGmail() {
  const returnUrl = window.location.href.split('#')[0]; // Remove hash
  window.location.href = `https://hack.oath.email/api/auth/sandbox/start?returnUrl=${encodeURIComponent(returnUrl)}`;
}
```

**Step 2:** Extract tokens from URL hash on page load

```javascript
function checkForOAuthTokens() {
  const hash = window.location.hash;

  if (hash && hash.startsWith('#oauth_')) {
    try {
      // Extract and decode token data
      const encodedData = hash.substring(7); // Remove '#oauth_'
      const tokenData = JSON.parse(decodeURIComponent(encodedData));

      if (tokenData.error) {
        console.error('OAuth error:', tokenData.error);
        alert('Authentication failed: ' + tokenData.error);
      } else {
        console.log('Got tokens:', tokenData);

        // Store tokens
        localStorage.setItem('gmail_tokens', JSON.stringify(tokenData));

        // Clear hash from URL
        history.replaceState(null, null, ' ');

        // Now you can use the tokens
        fetchEmails(tokenData.access_token);
      }
    } catch (error) {
      console.error('Failed to parse tokens:', error);
    }
  }
}

// Run on page load
window.addEventListener('load', checkForOAuthTokens);
```

---

## Complete Integration Example

Here's a complete, production-ready example:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Gmail Integration Example</title>
</head>
<body>
  <h1>Gmail Integration Demo</h1>
  <button id="connectBtn" onclick="connectGmail()">Connect Gmail</button>
  <button id="fetchBtn" onclick="fetchEmails()" disabled>Fetch Emails</button>
  <button id="disconnectBtn" onclick="disconnect()" disabled>Disconnect</button>

  <div id="status"></div>
  <div id="emails"></div>

  <script>
    const OAUTH_BRIDGE_URL = 'https://hack.oath.email';
    const STORAGE_KEY = 'gmail_tokens';

    // Check if already authenticated
    function checkAuth() {
      const tokens = getStoredTokens();
      if (tokens) {
        updateUI(true);
        showStatus('Connected as ' + tokens.email);
      }
    }

    // Store tokens securely
    function storeTokens(tokens) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      updateUI(true);
      showStatus('Connected as ' + tokens.email);
    }

    function getStoredTokens() {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    }

    function updateUI(connected) {
      document.getElementById('connectBtn').disabled = connected;
      document.getElementById('fetchBtn').disabled = !connected;
      document.getElementById('disconnectBtn').disabled = !connected;
    }

    function showStatus(message) {
      document.getElementById('status').textContent = message;
    }

    function showEmails(emails) {
      const div = document.getElementById('emails');
      div.innerHTML = '<h2>Recent Emails:</h2>' +
        emails.map(e => `<div>${e.snippet}</div>`).join('');
    }

    // Connect to Gmail
    function connectGmail() {
      const returnUrl = window.location.href.split('#')[0];
      const oauthUrl = `${OAUTH_BRIDGE_URL}/api/auth/sandbox/start?returnUrl=${encodeURIComponent(returnUrl)}`;

      // Option 1: Popup (recommended)
      const popup = window.open(oauthUrl, 'oauth', 'width=600,height=700');

      // Option 2: Same window (uncomment to use)
      // window.location.href = oauthUrl;
    }

    // Listen for OAuth callback (popup mode)
    window.addEventListener('message', (event) => {
      if (event.data.type === 'OAUTH_SUCCESS') {
        storeTokens(event.data.data);
        showStatus('Successfully connected!');
      } else if (event.data.type === 'OAUTH_ERROR') {
        showStatus('Authentication failed: ' + event.data.error);
      }
    });

    // Check for tokens in URL (same-window mode)
    function checkForOAuthTokens() {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#oauth_')) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(hash.substring(7)));
          if (!tokenData.error) {
            storeTokens(tokenData);
          } else {
            showStatus('Authentication failed: ' + tokenData.error);
          }
          history.replaceState(null, null, ' ');
        } catch (error) {
          console.error('Failed to parse tokens:', error);
        }
      }
    }

    // Fetch emails from Gmail
    async function fetchEmails() {
      let tokens = getStoredTokens();
      if (!tokens) {
        showStatus('Please connect first');
        return;
      }

      // Check if token expired
      if (Date.now() / 1000 > tokens.expires_in) {
        showStatus('Token expired, refreshing...');
        const newAccessToken = await refreshToken();
        if (!newAccessToken) return;
        tokens = getStoredTokens();
      }

      try {
        const response = await fetch(
          'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
          {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            }
          }
        );

        if (response.status === 401) {
          // Token invalid, try refresh
          const newAccessToken = await refreshToken();
          if (newAccessToken) {
            return fetchEmails(); // Retry
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch emails');
        }

        const data = await response.json();
        showEmails(data.messages || []);
        showStatus('Fetched ' + (data.messages?.length || 0) + ' emails');
      } catch (error) {
        showStatus('Error: ' + error.message);
      }
    }

    // Refresh access token
    async function refreshToken() {
      const tokens = getStoredTokens();
      if (!tokens?.refresh_token) {
        showStatus('No refresh token, please reconnect');
        disconnect();
        return null;
      }

      try {
        const response = await fetch(`${OAUTH_BRIDGE_URL}/api/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: tokens.refresh_token })
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const newTokens = await response.json();

        // Update tokens
        tokens.access_token = newTokens.access_token;
        tokens.expires_in = newTokens.expires_in;
        if (newTokens.refresh_token) {
          tokens.refresh_token = newTokens.refresh_token;
        }

        storeTokens(tokens);
        showStatus('Token refreshed successfully');
        return newTokens.access_token;
      } catch (error) {
        showStatus('Failed to refresh token, please reconnect');
        disconnect();
        return null;
      }
    }

    // Disconnect
    function disconnect() {
      localStorage.removeItem(STORAGE_KEY);
      updateUI(false);
      document.getElementById('emails').innerHTML = '';
      showStatus('Disconnected');
    }

    // Initialize
    window.addEventListener('load', () => {
      checkAuth();
      checkForOAuthTokens();
    });
  </script>
</body>
</html>
```

---

## Security Best Practices

### 1. Token Storage

**Never** store tokens in:
- ❌ Cookies (vulnerable to CSRF)
- ❌ URL parameters (visible in logs)
- ❌ Plain localStorage on shared computers

**Recommended:**
- ✅ Use `sessionStorage` for temporary sessions
- ✅ Use `localStorage` with encryption for persistent sessions
- ✅ Clear tokens on window/tab close for sensitive apps

### 2. Token Validation

Always validate tokens before using:

```javascript
async function isTokenValid(accessToken) {
  const response = await fetch('https://hack.oath.email/api/token/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken })
  });

  const result = await response.json();
  return result.valid;
}
```

### 3. HTTPS Only

Always use HTTPS in production. The OAuth bridge enforces secure cookies and redirects in production environments.

### 4. Origin Verification

When using popup mode, verify the postMessage origin:

```javascript
window.addEventListener('message', (event) => {
  // Verify origin
  if (event.origin !== 'https://hack.oath.email') {
    console.warn('Ignored postMessage from unknown origin:', event.origin);
    return;
  }

  // Process message...
});
```

---

## Rate Limiting

The OAuth bridge enforces rate limits to prevent abuse:

- **Limit:** 100 requests per 15 minutes per IP address
- **Applies to:** All OAuth bridge endpoints
- **Response:** HTTP 429 with `Retry-After` header

**Error Response:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

**Headers:**
```
Retry-After: 900
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707600000
```

---

## Error Handling

### Common Errors

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `MISSING_RETURN_URL` | 400 | returnUrl parameter missing | Include returnUrl in start request |
| `INVALID_STATE` | 403 | CSRF state validation failed | Restart OAuth flow |
| `MISSING_CODE` | 400 | Authorization code missing | Check Google OAuth configuration |
| `TOKEN_EXCHANGE_FAILED` | 500 | Failed to exchange code | Verify OAuth credentials |
| `REFRESH_FAILED` | 401 | Token refresh failed | Re-authenticate user |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry |

### Error Handling Example

```javascript
async function handleOAuthError(error) {
  switch (error.code) {
    case 'REFRESH_FAILED':
      // Token refresh failed, need to re-authenticate
      alert('Your session has expired. Please sign in again.');
      connectGmail();
      break;

    case 'RATE_LIMIT_EXCEEDED':
      // Rate limited, show retry time
      const minutes = Math.ceil(error.retryAfter / 60);
      alert(`Too many requests. Please try again in ${minutes} minutes.`);
      break;

    case 'INVALID_STATE':
      // CSRF attack or cookie expired
      alert('Security validation failed. Please try again.');
      connectGmail();
      break;

    default:
      alert('Authentication error: ' + error.message);
  }
}
```

---

## Testing

### Test Page

A test page is available at:
- **Production:** https://hack.oath.email/test-oauth-bridge.html
- **Local:** http://localhost:3000/test-oauth-bridge.html

This page allows you to:
- Test the complete OAuth flow
- Refresh tokens
- Validate tokens
- Check service health

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open test page:
   ```
   http://localhost:3000/test-oauth-bridge.html
   ```

3. Click "Connect Gmail" to test the flow

---

## Troubleshooting

### Issue: "invalid_request" or "redirect_uri_mismatch"

**Cause:** The redirect URI doesn't match what's configured in Google Cloud Console.

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find OAuth client ID: `1048905392258-e9n7196r2dd5l1tep20o7hbr6bu06npf`
3. Add these redirect URIs:
   - `https://hack.oath.email/api/auth/sandbox/callback/google`
   - `http://localhost:3000/api/auth/sandbox/callback/google` (for local testing)

### Issue: Popup blocked

**Solution:**
- Ask users to allow popups for your domain
- Use same-window flow as fallback
- Show clear messaging before opening popup

### Issue: Token expired

**Solution:**
- Check `expires_in` timestamp before API calls
- Automatically refresh token when expired
- Handle 401 responses by refreshing token

### Issue: No refresh token received

**Cause:** User may have already granted consent previously.

**Solution:**
- The OAuth flow uses `prompt=consent` to force consent screen
- If still no refresh token, user must revoke app access in [Google Account Settings](https://myaccount.google.com/permissions)
- Then re-authenticate

---

## FAQ

**Q: Do I need to register my sandbox URL?**
A: No! The OAuth bridge is designed for dynamic sandbox URLs. You only need to pass your sandbox URL as the `returnUrl` parameter.

**Q: Are tokens stored on the server?**
A: No. The OAuth bridge is completely stateless. Tokens flow through the server during the OAuth exchange but are never persisted.

**Q: Can I use this for write operations (send emails)?**
A: No. The current scopes are read-only (`gmail.readonly`, `calendar.readonly`). Contact the platform team if you need write access.

**Q: How long are tokens valid?**
A: Access tokens typically expire after 1 hour. Use the refresh token to get new access tokens without re-authenticating the user.

**Q: What happens if I hit the rate limit?**
A: You'll receive a 429 response with a `Retry-After` header indicating when you can retry. The limit is 100 requests per 15 minutes.

**Q: Can I test locally?**
A: Yes! The OAuth bridge automatically detects localhost and uses the appropriate redirect URI. Just make sure `http://localhost:3000/api/auth/sandbox/callback/google` is added to your Google OAuth client.

---

## Support

For issues or questions:
1. Check the [troubleshooting section](#troubleshooting)
2. Review the [complete integration example](#complete-integration-example)
3. Test with the [test page](https://hack.oath.email/test-oauth-bridge.html)
4. Contact the platform team if issues persist

---

## Changelog

### v1.0.0 (2026-02-10)
- ✅ Initial release
- ✅ OAuth flow for Gmail and Calendar (read-only)
- ✅ Token refresh and validation endpoints
- ✅ Rate limiting (100 req/15min)
- ✅ Support for both popup and same-window flows
- ✅ Dynamic host detection for localhost and production
