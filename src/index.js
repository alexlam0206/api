import { SignJWT, jwtVerify } from 'jose';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    
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
    const { firebaseUid, email } = await request.json();

    // Verify Firebase token
    const isValid = await verifyFirebaseToken(firebaseToken, firebaseUid, env);
    
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

async function verifyFirebaseToken(token, expectedUid, env) {
  try {
    // Firebase token verification endpoint
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );

    if (!response.ok) return false;
    
    const data = await response.json();
    const user = data.users?.[0];
    
    return user && user.localId === expectedUid;
  } catch (error) {
    console.error('Firebase verification error:', error);
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