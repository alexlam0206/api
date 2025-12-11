# Firebase User ID Synchronization for WordGarden

## The Challenge

Firebase uses its own unique user IDs (UIDs) that are different from any user identification system in Cloudflare Workers. You need to synchronize these IDs so your Cloudflare Worker can identify users authenticated through Firebase.

## Solution Approaches

### 1. **Firebase Custom Tokens (Recommended)**

Create a secure token exchange system where Firebase-authenticated users get a Cloudflare-compatible token.

```javascript
// In your frontend (after Firebase authentication)
async function getCloudflareToken(firebaseUser) {
  // Get Firebase ID token
  const firebaseToken = await firebaseUser.getIdToken();
  
  // Exchange for Cloudflare token via your API
  const response = await fetch('/api/exchange-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email
    })
  });
  
  const { cloudflareToken } = await response.json();
  return cloudflareToken;
}
```

### 2. **JWT Token with Firebase UID**

Create a JWT token that includes the Firebase UID as a claim.

```javascript
// Cloudflare Worker token validation function (enhanced)
async function extractUserIdFromToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Support both Firebase UID and standard JWT claims
    return payload.firebase_uid || payload.sub || payload.uid || payload.user_id;
  } catch (error) {
    return null;
  }
}
```

### 3. **API Gateway Pattern**

Create a separate API endpoint that validates Firebase tokens and issues Cloudflare tokens.

## Implementation Example

### Backend Token Exchange Service

```javascript
// Add this to your Cloudflare Worker
async function handleTokenExchange(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const firebaseToken = authHeader.substring(7);
    const { firebaseUid, email } = await request.json();

    // Verify Firebase token (you'd implement this verification)
    const isValid = await verifyFirebaseToken(firebaseToken, firebaseUid);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid Firebase token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate Cloudflare-compatible JWT token
    const cloudflareToken = await generateCloudflareToken(firebaseUid, email, env);
    
    return new Response(JSON.stringify({ 
      cloudflareToken,
      expiresIn: 3600 // 1 hour
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function generateCloudflareToken(firebaseUid, email, env) {
  // Use a library like jose or implement JWT creation
  // Include firebase_uid in the payload
  const payload = {
    firebase_uid: firebaseUid,
    email: email,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000)
  };
  
  // Sign with your secret key stored in env
  return await signJWT(payload, env.JWT_SECRET);
}
```

### Frontend Integration

```javascript
// React/Next.js example
import { getAuth, onAuthStateChanged } from 'firebase/auth';

class WordGardenAPI {
  constructor() {
    this.auth = getAuth();
    this.cloudflareToken = null;
    this.tokenExpiry = null;
  }

  async getValidToken() {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Check if existing token is still valid
    if (this.cloudflareToken && this.tokenExpiry > Date.now()) {
      return this.cloudflareToken;
    }

    // Get new token
    const firebaseToken = await user.getIdToken();
    const response = await fetch('/api/exchange-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
        email: user.email
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange token');
    }

    const { cloudflareToken, expiresIn } = await response.json();
    this.cloudflareToken = cloudflareToken;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    
    return cloudflareToken;
  }

  async generateText(prompt, options = {}) {
    const token = await this.getValidToken();
    
    const response = await fetch('/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        max_tokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7
      })
    });

    if (response.status === 429) {
      throw new Error('Monthly quota exceeded');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }
}

// Usage
const wordGarden = new WordGardenAPI();

async function generateContent() {
  try {
    const result = await wordGarden.generateText('Write a poem about gardens');
    console.log('Generated:', result.result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

## Security Considerations

1. **Token Expiration**: Keep Cloudflare tokens short-lived (1 hour max)
2. **HTTPS Only**: Always use HTTPS for token exchange
3. **Rate Limiting**: Implement rate limiting on token exchange endpoint
4. **Secret Management**: Store JWT secrets securely in Cloudflare environment variables
5. **Firebase Verification**: Always verify Firebase tokens before issuing Cloudflare tokens

## Environment Variables

Add to your `wrangler.toml`:

```toml
[env.production.vars]
JWT_SECRET = "your-jwt-secret-key"
FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

## Deployment Steps

1. Deploy the Cloudflare Worker
2. Set up KV namespace for quota storage
3. Configure environment variables
4. Update your frontend to use the token exchange flow
5. Test the complete authentication flow

This approach maintains security while allowing seamless integration between Firebase authentication and your Cloudflare Worker API.