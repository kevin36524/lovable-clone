# OAuth Bridge Server - Implementation Requirements

**Project**: hack.oath.email OAuth Bridge for Sandbox Mail Application
**Purpose**: Stateless OAuth 2.0 bridge to enable Gmail/Calendar access for sandbox applications
**Date**: 2026-02-10

---

## 📋 Overview

Implement a stateless OAuth bridge server that facilitates Google OAuth authentication for sandbox mail applications. The server acts as an intermediary between dynamic sandbox URLs and Google OAuth, enabling secure token exchange without storing any user tokens.

### Key Principles
- 🔒 **Stateless** - No token storage on server
- ⚡ **Privacy-first** - Tokens flow through, never persist
- 🎯 **Single purpose** - OAuth facilitation only
- 🔄 **Session-based state** - Temporary session storage for OAuth flow (10 min max)

---

## 🎯 Functional Requirements

### FR-1: OAuth Initiation
**Endpoint**: `GET /api/auth/sandbox/start`

**Purpose**: Initiate OAuth flow and redirect to Google

**Query Parameters**:
- `returnUrl` (required) - The sandbox URL to return tokens to

**Behavior**:
1. Validate `returnUrl` parameter exists
2. Generate cryptographically random `state` (32 bytes)
3. Store `state` and `returnUrl` in session
4. Generate Google OAuth URL with required scopes
5. Redirect user to Google OAuth

**Response**: `302 Redirect` to Google OAuth

**Session Data Stored**:
```typescript
{
  oauthState: string,     // CSRF protection
  returnUrl: string       // Original sandbox URL
}
```

---

### FR-2: OAuth Callback
**Endpoint**: `GET /api/auth/sandbox/callback/google`

**Purpose**: Handle Google OAuth callback and exchange code for tokens

**Query Parameters** (from Google):
- `code` (string) - Authorization code
- `state` (string) - CSRF token
- `error` (optional) - Error code if OAuth failed

**Behavior**:
1. Check for error parameter → redirect to returnUrl with error
2. Validate `state` matches session `oauthState`
3. Retrieve `returnUrl` from session
4. Exchange authorization `code` for tokens via Google API
5. Get user info (email, name, picture)
6. Destroy session (cleanup)
7. Redirect to `/api/auth/sandbox/done` with tokens in query params

**Response**: `302 Redirect` to `/api/auth/sandbox/done`

**Redirect URL Format**:
```
/api/auth/sandbox/done?access_token=...&refresh_token=...&expires_in=...&email=...&name=...&picture=...
```

**Error Handling**:
- Invalid state → `403 Forbidden`
- Token exchange failure → Redirect to `returnUrl?error=token_exchange_failed`
- Missing session → `400 Bad Request`

---

### FR-3: OAuth Completion Page
**Endpoint**: `GET /api/auth/sandbox/done`

**Purpose**: Send tokens back to sandbox frontend via postMessage

**Query Parameters**:
- `access_token` (string)
- `refresh_token` (string)
- `expires_in` (number) - Timestamp
- `email` (string)
- `name` (string, optional)
- `picture` (string, optional)
- `error` (string, optional)

**Behavior**:
1. Render HTML page with embedded JavaScript
2. JavaScript extracts tokens from URL query params
3. Use `window.opener.postMessage()` to send tokens back to sandbox
4. Auto-close popup after 1 second

**Response**: HTML page with postMessage logic

**postMessage Format**:
```typescript
{
  type: 'OAUTH_SUCCESS',
  data: {
    access_token: string,
    refresh_token: string,
    expires_in: number,
    email: string,
    name?: string,
    picture?: string,
    timestamp: number
  }
}
```

**postMessage Target**: `window.opener` (the sandbox that opened the popup)

---

### FR-4: Token Refresh Proxy
**Endpoint**: `POST /api/token/refresh`

**Purpose**: Proxy token refresh requests to Google (stateless)

**Request Body**:
```json
{
  "refresh_token": "string (required)"
}
```

**Behavior**:
1. Validate `refresh_token` exists in request body
2. Call Google OAuth API to refresh token
3. Return new tokens to client
4. **Do NOT store tokens**

**Success Response** (200):
```json
{
  "access_token": "string",
  "expires_in": 1234567890,
  "token_type": "Bearer",
  "refresh_token": "string (optional, if Google returns new one)"
}
```

**Error Response** (401):
```json
{
  "error": "Failed to refresh token",
  "message": "Please re-authenticate",
  "code": "REFRESH_FAILED"
}
```

---

### FR-5: Token Validation
**Endpoint**: `POST /api/token/validate`

**Purpose**: Validate access token with Google (stateless)

**Request Body**:
```json
{
  "access_token": "string (required)"
}
```

**Behavior**:
1. Validate `access_token` exists in request body
2. Call Google API to get user info (validates token)
3. Return validation result

**Success Response** (200):
```json
{
  "valid": true,
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://..."
}
```

**Invalid Token Response** (200):
```json
{
  "valid": false
}
```

---

### FR-6: Health Check
**Endpoint**: `GET /health`

**Purpose**: Server health and status check

**Response** (200):
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T12:34:56Z",
  "stateless": true,
  "tokenStorage": "none"
}
```

---

## 🔒 Non-Functional Requirements

### NFR-1: Security

**OAuth Security**:
- ✅ State parameter MUST be cryptographically random (32 bytes minimum)
- ✅ State MUST be validated on callback
- ✅ Sessions MUST expire after 10 minutes
- ✅ HTTPS MUST be enforced in production
- ✅ Session cookies MUST be HttpOnly
- ✅ Session cookies MUST be Secure in production

**Token Security**:
- ✅ Tokens MUST NEVER be logged
- ✅ Tokens MUST NEVER be stored in database or persistent storage
- ✅ Tokens MUST only exist in memory during request processing
- ✅ Sessions MUST be destroyed after OAuth completion

**CORS**:
- ✅ Allow all origins (necessary for dynamic sandbox URLs)
- ✅ Allow credentials (for session cookies)
- ✅ Handle preflight OPTIONS requests

**Rate Limiting**:
- ✅ 100 requests per 15 minutes per IP address
- ✅ Apply to all endpoints

**Input Validation**:
- ✅ Validate all query parameters
- ✅ Sanitize returnUrl to prevent open redirects (optional)
- ✅ Validate request body JSON

---

### NFR-2: Performance

**Response Times**:
- Health check: < 50ms
- OAuth initiation: < 100ms
- OAuth callback: < 500ms (includes Google API call)
- Token refresh: < 500ms (includes Google API call)

**Scalability**:
- Server MUST be stateless (except for temporary sessions)
- Support horizontal scaling
- No database required

---

### NFR-3: Reliability

**Error Handling**:
- All errors MUST return appropriate HTTP status codes
- All errors MUST include error message
- Network errors MUST be handled gracefully

**Logging**:
- Log OAuth flow events (start, callback, done)
- Log token refresh attempts
- Log errors with context
- **DO NOT** log tokens, codes, or user emails

**Session Management**:
- Sessions MUST expire after 10 minutes
- Expired sessions MUST be cleaned up automatically
- Use memory store with automatic pruning

---

### NFR-4: Maintainability

**Code Quality**:
- TypeScript for type safety
- Clear separation of concerns (routes, services, middleware)
- Comprehensive error handling
- Meaningful variable names

**Documentation**:
- JSDoc comments for all functions
- README with setup instructions
- Environment variable documentation

---

## 🏗️ Technical Architecture

### Technology Stack

**Runtime**: Node.js 20+

**Framework**: Express.js 4.x

**Key Dependencies**:
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "googleapis": "^130.0.0",
  "express-session": "^1.17.3",
  "memorystore": "^1.6.7",
  "dotenv": "^16.3.1",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5"
}
```

### Directory Structure

```
src/
├── index.ts                    # Main server file
├── routes/
│   └── auth/
│       └── sandbox.ts          # Sandbox OAuth routes
├── api/
│   └── token.ts                # Token management endpoints
├── services/
│   └── google-oauth.ts         # Google OAuth service
├── middleware/
│   └── validate.ts             # Request validation
└── config/
    └── google.ts               # Google OAuth config
```

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Google OAuth - Sandbox Mail App
# Note: These credentials are separate from your platform auth
SANDBOX_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SANDBOX_GOOGLE_CLIENT_SECRET=your-client-secret
SANDBOX_GOOGLE_REDIRECT_URI=https://hack.oath.email/api/auth/sandbox/callback/google

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-random-session-secret
```

**Note**: The `SANDBOX_GOOGLE_CLIENT_*` variables are for the sandbox mail app OAuth client (already configured in GCP).

---

## 📝 API Specifications

### Complete Request/Response Examples

#### 1. Start OAuth Flow

**Request**:
```http
GET /api/auth/sandbox/start?returnUrl=https%3A%2F%2Fsandbox-abc123.hack.oath.email HTTP/1.1
Host: hack.oath.email
```

**Response**:
```http
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...
Set-Cookie: connect.sid=s%3Axyz123...; Path=/; HttpOnly; Secure
```

---

#### 2. OAuth Callback

**Request** (from Google):
```http
GET /api/auth/sandbox/callback/google?code=4/0AY0e-g7...&state=abc123... HTTP/1.1
Host: hack.oath.email
Cookie: connect.sid=s%3Axyz123...
```

**Response**:
```http
HTTP/1.1 302 Found
Location: /api/auth/sandbox/done?access_token=ya29.a0...&refresh_token=1//0g...&expires_in=1707567890&email=user@gmail.com&name=John+Doe&picture=https://...
```

---

#### 3. OAuth Done Page

**Request**:
```http
GET /api/auth/sandbox/done?access_token=ya29.a0...&refresh_token=1//0g...&expires_in=1707567890&email=user@gmail.com HTTP/1.1
Host: hack.oath.email
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
<head>
  <title>OAuth Complete</title>
  ...
</head>
<body>
  <script>
    // postMessage logic here
  </script>
</body>
</html>
```

---

#### 4. Refresh Token

**Request**:
```http
POST /api/token/refresh HTTP/1.1
Host: hack.oath.email
Content-Type: application/json

{
  "refresh_token": "1//0gDxPHHBh..."
}
```

**Success Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "ya29.a0AfH6SM...",
  "expires_in": 1707571490,
  "token_type": "Bearer"
}
```

**Error Response**:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Failed to refresh token",
  "message": "Please re-authenticate",
  "code": "REFRESH_FAILED"
}
```

---

## 🔧 Google OAuth Configuration

### ✅ Already Configured

You have already set up the Google OAuth client in GCP with:

**Scopes**:
- `gmail.readonly`, `gmail.modify`, `gmail.compose`
- `calendar.readonly`
- `userinfo.email`, `userinfo.profile`

**Authorized redirect URIs**:
- `https://hack.oath.email/api/auth/sandbox/callback/google`
- `http://localhost:3000/api/auth/sandbox/callback/google` (optional)

**Credentials**:
- Client ID → `SANDBOX_GOOGLE_CLIENT_ID`
- Client Secret → `SANDBOX_GOOGLE_CLIENT_SECRET`

No additional GCP configuration needed!

---

## 🧪 Testing Requirements

### Test Cases

#### TC-1: Successful OAuth Flow
1. Start OAuth with valid returnUrl
2. Simulate Google callback with code and state
3. Verify tokens returned to sandbox
4. Verify session destroyed

**Expected**: 200 OK, tokens sent via postMessage

---

#### TC-2: Invalid State Parameter
1. Start OAuth flow
2. Callback with mismatched state
3. Verify rejection

**Expected**: 403 Forbidden

---

#### TC-3: Token Refresh Success
1. POST to /api/token/refresh with valid refresh_token
2. Verify new access_token returned

**Expected**: 200 OK with new tokens

---

#### TC-4: Token Refresh Failure
1. POST to /api/token/refresh with invalid refresh_token
2. Verify error response

**Expected**: 401 Unauthorized

---

#### TC-5: Session Expiry
1. Start OAuth flow
2. Wait > 10 minutes
3. Attempt callback
4. Verify session expired error

**Expected**: 400 Bad Request

---

#### TC-6: Missing returnUrl
1. GET /api/auth/sandbox/start without returnUrl
2. Verify error response

**Expected**: 400 Bad Request

---

#### TC-7: Rate Limiting
1. Make > 100 requests in 15 minutes
2. Verify rate limit exceeded

**Expected**: 429 Too Many Requests

---

## 📦 Implementation Checklist

### Phase 1: Setup
- [ ] Initialize Node.js/TypeScript project
- [ ] Install dependencies
- [ ] Set up directory structure
- [ ] Configure TypeScript
- [ ] Set up environment variables (SANDBOX_GOOGLE_CLIENT_ID, SANDBOX_GOOGLE_CLIENT_SECRET)
- [ ] Create `.env.example`
- [ ] ✅ GCP OAuth client already configured (skip)

### Phase 2: Core Server
- [ ] Implement main server (index.ts)
- [ ] Set up Express middleware (CORS, helmet, rate limiting)
- [ ] Set up session management with memorystore
- [ ] Implement health check endpoint
- [ ] Test server starts successfully

### Phase 3: Google OAuth Service
- [ ] Implement GoogleOAuthService class
- [ ] Implement `getAuthUrl()` method
- [ ] Implement `getTokens()` method
- [ ] Implement `refreshAccessToken()` method
- [ ] Implement `getUserInfo()` method
- [ ] Test with Google OAuth Playground

### Phase 4: OAuth Routes
- [ ] Implement `/api/auth/sandbox/start` endpoint
- [ ] Implement `/api/auth/sandbox/callback/google` endpoint
- [ ] Implement `/api/auth/sandbox/done` endpoint
- [ ] Add session state management
- [ ] Add CSRF protection (state validation)
- [ ] Test complete OAuth flow

### Phase 5: Token Management
- [ ] Implement `/api/token/refresh` endpoint
- [ ] Implement `/api/token/validate` endpoint
- [ ] Add error handling
- [ ] Test token refresh flow
- [ ] Test token validation

### Phase 6: Security
- [ ] Verify HTTPS enforcement
- [ ] Verify session security (HttpOnly, Secure)
- [ ] Verify state validation
- [ ] Verify rate limiting works
- [ ] Verify CORS configuration
- [ ] Security audit

### Phase 7: Testing
- [ ] Write unit tests for services
- [ ] Write integration tests for endpoints
- [ ] Manual end-to-end testing
- [ ] Test error scenarios
- [ ] Load testing

### Phase 8: Deployment
- [ ] Set up production environment
- [ ] Add SANDBOX_GOOGLE_CLIENT_ID and SANDBOX_GOOGLE_CLIENT_SECRET to production env
- [ ] Configure DNS (if needed)
- [ ] Set up SSL certificate (if needed)
- [ ] Deploy to production
- [ ] Verify health check
- [ ] Test production OAuth flow with real sandbox

### Phase 9: Monitoring
- [ ] Set up logging
- [ ] Set up error tracking
- [ ] Set up uptime monitoring
- [ ] Document runbook for common issues

---

## 🚨 Critical Security Reminders

### DO NOT:
- ❌ Store tokens in database
- ❌ Store tokens in logs
- ❌ Store tokens in persistent storage
- ❌ Log user emails or tokens
- ❌ Skip state validation
- ❌ Use insecure session cookies
- ❌ Allow non-HTTPS in production

### DO:
- ✅ Validate state parameter
- ✅ Use cryptographically random state
- ✅ Destroy sessions after OAuth completion
- ✅ Use HTTPS everywhere
- ✅ Set HttpOnly and Secure on cookies
- ✅ Implement rate limiting
- ✅ Handle errors gracefully

---

## 📞 Support Information

### Related Documentation
- [Gmail OAuth Migration Plan](./GMAIL_OAUTH_MIGRATION_PLAN.md)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)

### Environment Setup Guide
See Section 2.3 in [GMAIL_OAUTH_MIGRATION_PLAN.md](./GMAIL_OAUTH_MIGRATION_PLAN.md)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-10
**Status**: Ready for Implementation
