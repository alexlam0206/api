import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { SignJWT, jwtVerify } from 'jose';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

// Helper to handle OPTIONS requests
function handleOptions(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  return new Response(null, {
    headers: corsHeaders,
  });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function verifyToken(token, env) {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'your-secret-key-change-me');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

async function generateCloudflareToken(uid, email, env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'your-secret-key-change-me');
  const jwt = await new SignJWT({ uid, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // 24 hours
    .sign(secret);
  return jwt;
}

// Mock Firebase verification for now - in production use a real library or verify signature
async function verifyFirebaseToken(token, uid, env) {
  // In a real app, verify the token signature with Google's keys
  // For now, we trust the client's token if it exists
  return !!token;
}

// Helper to get system limits
async function getSystemLimits(env) {
  const data = await env.WORDGARDEN_KV.get('system:limits');
  return data ? JSON.parse(data) : { monthly: 50, daily: 10 };
}

// Helper to get user limits
async function getUserLimits(uid, env) {
  const data = await env.WORDGARDEN_KV.get(`limit:${uid}`);
  return data ? JSON.parse(data) : null;
}

async function handleUpdateGlobalLimits(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || payload.email !== 'nok@pgmiv.com') {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    const { monthly, daily } = await request.json();
    console.log('Updating global limits:', { monthly, daily });
    await env.WORDGARDEN_KV.put('system:limits', JSON.stringify({ monthly, daily }));

    return new Response(JSON.stringify({ success: true, limits: { monthly, daily } }), {
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Update global limits error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

async function handleUpdateUserLimit(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || payload.email !== 'nok@pgmiv.com') {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    const { email, limit, monthly, daily } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });

    // Find user uid
    const userKeys = await env.WORDGARDEN_KV.list({ prefix: 'user:' });
    let targetUid = null;
    
    for (const key of userKeys.keys) {
      const userData = await env.WORDGARDEN_KV.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email === email) {
          targetUid = user.firebaseUid;
          break;
        }
      }
    }

    if (!targetUid) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Support both old 'limit' param (monthly only) and new structure
    const limits = {
      monthly: monthly !== undefined ? monthly : (limit !== undefined ? limit : 50),
      daily: daily !== undefined ? daily : 10
    };

    console.log(`Updating limits for user ${email} (${targetUid}):`, limits);
    await env.WORDGARDEN_KV.put(`limit:${targetUid}`, JSON.stringify(limits));

    return new Response(JSON.stringify({ success: true, limits }), {
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Update user limit error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
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
    const payload = await verifyToken(token, env);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = payload.uid;
    
    // Get user quota from KV
    const quotaKey = `quota:${userId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };
    
    // Determine limits
    const userLimits = await getUserLimits(userId, env);
    const systemLimits = await getSystemLimits(env);
    const monthlyLimit = userLimits?.monthly ?? systemLimits.monthly;

    return new Response(JSON.stringify({
      usage: quota.count,
      month: quota.month,
      limit: monthlyLimit
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('User quota error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
      expiresIn: 86400 // 24 hours
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
    const payload = await verifyToken(token, env);
    
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check email claim directly for admin access
    const userEmail = payload.email;
    if (userEmail !== 'nok@pgmiv.com') {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all users and their usage data
    const users = [];
    const userKeys = await env.WORDGARDEN_KV.list({ prefix: 'user:' });
    const systemLimits = await getSystemLimits(env);
    
    for (const key of userKeys.keys) {
      const userData = await env.WORDGARDEN_KV.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        const quotaKey = `quota:${user.firebaseUid}`;
        const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
        const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };
        
        // Get specific limits
        const userLimit = await getUserLimits(user.firebaseUid, env);
        const monthlyLimit = userLimit?.monthly ?? systemLimits.monthly;
        const dailyLimit = userLimit?.daily ?? systemLimits.daily;

        users.push({
          id: user.firebaseUid,
          email: user.email,
          name: user.name || 'Unknown',
          usage: quota.count, // Legacy support
          monthlyUsage: quota.count,
          dailyUsage: 0, // TODO: Implement daily tracking
          month: quota.month,
          monthlyLimit,
          dailyLimit,
          lastActive: user.lastActive || 'Never'
        });
      }
    }

    return new Response(JSON.stringify({ 
      users,
      systemLimits 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
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

async function handleDeleteUser(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || payload.email !== 'nok@pgmiv.com') {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    const { email } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });

    // Find user key by email (inefficient but works for small scale)
    // Better: maintain email->uid mapping
    const userKeys = await env.WORDGARDEN_KV.list({ prefix: 'user:' });
    let targetUid = null;
    
    for (const key of userKeys.keys) {
      const userData = await env.WORDGARDEN_KV.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email === email) {
          targetUid = user.firebaseUid;
          break;
        }
      }
    }

    if (targetUid) {
      await env.WORDGARDEN_KV.delete(`user:${targetUid}`);
      await env.WORDGARDEN_KV.delete(`quota:${targetUid}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

async function handleGenerate(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = payload.uid;
    
    // Check quota
    const quotaKey = `quota:${userId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    let quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth() };
    
    if (quota.month !== getCurrentMonth()) {
      quota = { count: 0, month: getCurrentMonth() };
    }
    
    // Determine limits
    const userLimits = await getUserLimits(userId, env);
    const systemLimits = await getSystemLimits(env);
    const monthlyLimit = userLimits?.monthly ?? systemLimits.monthly;
    
    if (quota.count >= monthlyLimit) {
      return new Response(JSON.stringify({ error: 'Monthly quota exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { prompt } = await request.json();
    
    // Call Cloudflare AI
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant for learning languages.' },
        { role: 'user', content: prompt }
      ]
    });
    
    // Increment quota
    quota.count++;
    await env.WORDGARDEN_KV.put(quotaKey, JSON.stringify(quota));
    
    return new Response(JSON.stringify({ result: aiResponse }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Generation error:', error);
    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDashboardPage(request, env, ctx) {
  try {
    // Manually serve dashboard.html to avoid getAssetFromKV mapping issues
    const assetPath = 'dashboard.html';
    const assetKey = assetManifest[assetPath];
    
    if (!assetKey) {
      throw new Error(`Asset not found in manifest: ${assetPath}`);
    }

    // Direct KV fetch using the binding verified in debug
    const body = await env.__STATIC_CONTENT.get(assetKey, 'arrayBuffer');
    
    if (!body) {
      throw new Error(`Asset body not found in KV for key: ${assetKey}`);
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/html');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
    headers.set('Cache-Control', 'public, max-age=3600');
    
    return new Response(body, {
      status: 200,
      headers: headers
    });
  } catch (e) {
    // Fallback or 404
    console.error('Dashboard error:', e);
    const errorDetails = {
      message: e.message,
      stack: e.stack,
      url: request.url,
      manifestKeys: Object.keys(assetManifest)
    };
    return new Response(`Dashboard not found. Error: ${JSON.stringify(errorDetails, null, 2)}`, { 
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    
    // API v1 routes
    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
      // API Root Info
      if (url.pathname === '/v1' || url.pathname === '/v1/') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          message: 'WordGarden API v1', 
          endpoints: {
            exchange_token: '/v1/exchange-token',
            dashboard: '/v1/dashboard',
            generate: '/v1/generate',
            user_quota: '/v1/user-quota',
            global_limits: '/v1/global-limits',
            user_limit: '/v1/user-limit'
          }
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (url.pathname === '/v1/exchange-token') {
        return handleTokenExchange(request, env);
      }
      if (url.pathname === '/v1/user-quota') {
        return handleUserQuota(request, env);
      }
      if (url.pathname === '/v1/dashboard') {
        return handleDashboard(request, env);
      }
      if (url.pathname === '/v1/generate') {
        return handleGenerate(request, env);
      }
      if (url.pathname === '/v1/user-delete') {
        return handleDeleteUser(request, env);
      }
      if (url.pathname === '/v1/global-limits') {
        return handleUpdateGlobalLimits(request, env);
      }
      if (url.pathname === '/v1/user-limit') {
        return handleUpdateUserLimit(request, env);
      }
      return new Response('Not Found', { status: 404 });
    }

    // Handle dashboard page specifically to add headers
    if (url.pathname === '/dashboard') {
      return handleDashboardPage(request, env, ctx);
    }

    // Handle root path - Redirect to dashboard or return API status
    if (url.pathname === '/') {
      const acceptHeader = request.headers.get('Accept') || '';
      if (acceptHeader.includes('text/html')) {
        return handleDashboardPage(request, env, ctx);
      }
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'WordGarden API',
        version: '1.0.0',
        endpoints: {
          dashboard: '/dashboard',
          api: '/v1'
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Static assets
    try {
      return await getAssetFromKV({
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      }, {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        manifest: assetManifest,
      });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  },
};
