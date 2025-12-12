import { SignJWT, jwtVerify, importX509 } from 'jose';
import { Ai } from '@cloudflare/ai';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Allow GET requests for Firebase config
    if (request.method === 'GET' && url.pathname === '/api/firebase-config') {
      return await handleFirebaseConfig(request, env);
    }
    
    // Serve dashboard.html for dashboard route
    if (request.method === 'GET' && url.pathname === '/dashboard') {
      return await handleDashboardPage(request, env, ctx);
    }
    
    // Secure dashboard endpoint - requires authentication
    if (request.method === 'GET' && url.pathname === '/api/dashboard') {
      return await handleDashboard(request, env);
    }
    
    // User quota endpoint - requires authentication
    if (request.method === 'GET' && url.pathname === '/api/user/quota') {
      return await handleUserQuota(request, env);
    }
    
    // User data endpoint - requires authentication
    if (request.method === 'GET' && url.pathname.startsWith('/api/user/')) {
      return await handleUserData(request, env);
    }
    
    // Require POST for other endpoints
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Token exchange endpoint
    if (url.pathname === '/api/exchange-token') {
      return await handleTokenExchange(request, env);
    }
    
    // AI generation endpoint
    if (url.pathname === '/v1/generate') {
      return await handleGenerate(request, env);
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDashboardPage(request, env, ctx) {
  try {
    return await getAssetFromKV(
      {
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: assetManifest,
        mapRequestToAsset: (req) => {
          return new Request(`${new URL(req.url).origin}/dashboard.html`, req);
        },
      }
    );
  } catch (e) {
    console.error('Dashboard page error:', e);
    return new Response('Dashboard not available', { status: 500 });
  }
}
async function handleUserQuota(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.substring(7);
    const userId = await extractUserIdFromToken(token, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user quota from KV
    const quotaKey = `quota:${userId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };
    
    return new Response(JSON.stringify({
      usage: quota.count,
      month: quota.month,
      limit: 50
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('User quota error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function handleTokenExchange(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const firebaseToken = authHeader.substring(7);
    const { firebaseUid, email, name } = await request.json();

    // Verify Firebase token
    const isValid = await verifyFirebaseToken(firebaseToken, firebaseUid, env);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid Firebase token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store user data in KV (this will be used for admin dashboard)
    const userKey = `user:${firebaseUid}`;
    const userData = {
      firebaseUid,
      email,
      name: name || email.split('@')[0],
      lastActive: new Date().toISOString()
    };
    await env.WORDGARDEN_KV.put(userKey, JSON.stringify(userData));

    // Generate Cloudflare-compatible JWT token
    const cloudflareToken = await generateCloudflareToken(firebaseUid, email, env);
    
    return new Response(JSON.stringify({ 
      cloudflareToken,
      expiresIn: 3600 // 1 hour
    }), {
      status: 200,      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGenerate(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cloudflareToken = authHeader.substring(7);
    const userId = await extractUserIdFromToken(cloudflareToken, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const quotaKey = `quota:${userId}`;
    const currentQuota = await env.WORDGARDEN_KV.get(quotaKey);
    const quotaData = currentQuota ? JSON.parse(currentQuota) : { count: 0, month: getCurrentMonth() };
    
    const currentMonth = getCurrentMonth();
    if (quotaData.month !== currentMonth) {
      quotaData.count = 0;
      quotaData.month = currentMonth;
    }

    if (quotaData.count >= 50) {
      return new Response(JSON.stringify({ error: 'quota exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await request.json();
    const { prompt, max_tokens = 512, temperature = 0.7 } = requestBody;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ai = new Ai(env.AI);
    const aiResponse = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens,
      temperature
    });

    quotaData.count += 1;
    await env.WORDGARDEN_KV.put(quotaKey, JSON.stringify(quotaData), {
      expirationTtl: 60 * 60 * 24 * 35 // 35 days to cover month transitions
    });

    return new Response(JSON.stringify({ result: aiResponse.response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleFirebaseConfig(request, env) {
  // Return Firebase configuration for the dashboard
  const config = {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: `${env.FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
    appId: env.FIREBASE_APP_ID
  };
  
  return new Response(JSON.stringify(config), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' // Allow dashboard to access this
    }
  });
}

async function verifyFirebaseToken(token, expectedUid, env) {
  try {
    const jwksUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      console.error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
      return false;
    }
    const certs = await response.json();

    const keyResolver = async (protectedHeader) => {
      const certificate = certs[protectedHeader.kid];
      if (!certificate) {
        throw new Error('Firebase certificate not found for kid: ' + protectedHeader.kid);
      }
      return importX509(certificate, 'RS256');
    };

    const { payload } = await jwtVerify(token, keyResolver, {
      audience: env.FIREBASE_PROJECT_ID, // Your Firebase Project ID
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      algorithms: ['RS256'],
    });

    // Check if the UID in the token matches the expected UID
    return payload.sub === expectedUid;

  } catch (error) {
    console.error('Firebase token verification error:', error);
    return false;
  }
}

async function generateCloudflareToken(firebaseUid, email, env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  
  return await new SignJWT({ 
    firebase_uid: firebaseUid,
    email: email,
    sub: firebaseUid // Standard JWT claim
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function extractUserIdFromToken(token, env) {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Support both Firebase UID and standard JWT claims
    return payload.firebase_uid || payload.sub;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Secure dashboard endpoint - requires Cloudflare JWT authentication
async function handleDashboard(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const userId = await extractUserIdFromToken(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only allow admin user (nok@pgmiv.com)
    // This is a basic check - you might want to store admin users in KV
    if (userId !== 'nok@pgmiv.com') {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all users and their usage data
    const users = [];
    const userKeys = await env.WORDGARDEN_KV.list({ prefix: 'user:' });
    
    for (const key of userKeys.keys) {
      const userData = await env.WORDGARDEN_KV.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        const quotaKey = `quota:${user.firebaseUid}`;
        const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
        const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };
        
        users.push({
          id: user.firebaseUid,
          email: user.email,
          name: user.name || 'Unknown',
          usage: quota.count,
          month: quota.month,
          lastActive: user.lastActive || 'Never'
        });
      }
    }

    return new Response(JSON.stringify({ users }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// User data endpoint - requires Cloudflare JWT authentication
async function handleUserData(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const userId = await extractUserIdFromToken(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract user ID from URL path
    const url = new URL(request.url);
    const pathUserId = url.pathname.split('/').pop();
    
    // Users can only access their own data, unless they're admin
    const isAdmin = userId === 'nok@pgmiv.com'; // Admin check
    if (!isAdmin && userId !== pathUserId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user data
    const userKey = `user:${pathUserId}`;
    const userData = await env.WORDGARDEN_KV.get(userKey);
    const quotaKey = `quota:${pathUserId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    
    if (!userData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = JSON.parse(userData);
    const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };

    return new Response(JSON.stringify({
      id: user.firebaseUid,
      email: user.email,
      name: user.name || 'Unknown',
      usage: quota.count,
      month: quota.month,
      lastActive: user.lastActive || 'Never'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('User data error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}