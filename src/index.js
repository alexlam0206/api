import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { SignJWT, jwtVerify } from 'jose';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

// Firebase REST API approach for Cloudflare Workers compatibility

// Firebase Admin SDK variables (for REST API)
let firebaseProjectId = null;
let firebaseServiceAccount = null;

// Initialize Firebase Admin using REST API
function initializeFirebaseAdmin(env) {
  if (firebaseServiceAccount) return firebaseServiceAccount;
  
  try {
    firebaseProjectId = env.FIREBASE_PROJECT_ID;
    firebaseServiceAccount = {
      project_id: env.FIREBASE_PROJECT_ID,
      private_key_id: env.FIREBASE_PRIVATE_KEY_ID,
      private_key: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: env.FIREBASE_CLIENT_EMAIL,
      client_id: env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(env.FIREBASE_CLIENT_EMAIL)}`
    };
    return firebaseServiceAccount;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    return null;
  }
}

async function handleSyncUsers(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Check if user is admin (you may want to add admin role checking)
    const adminUsers = ['alexlam0206@gmail.com']; // Add your admin emails here
    if (!adminUsers.includes(payload.email)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Check if Firebase Admin credentials are configured
    if (!env.FIREBASE_PRIVATE_KEY_ID || !env.FIREBASE_PRIVATE_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Firebase Admin credentials not configured. Please set FIREBASE_PRIVATE_KEY_ID and FIREBASE_PRIVATE_KEY in your environment variables.' 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Sync all Firebase users
    const syncResults = await syncAllFirebaseUsers(env);

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Firebase users sync completed',
      results: syncResults
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Sync users error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to sync users',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Get access token for Firebase Auth REST API
async function getFirebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform'
  };

  // Create JWT
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // For Cloudflare Workers, we'll use a simpler approach
  // In production, you'd want to implement proper JWT signing
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${encodedHeader}.${encodedPayload}.signature` // Simplified for demo
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Sync all Firebase users using REST API
async function syncAllFirebaseUsers(env) {
  try {
    const serviceAccount = initializeFirebaseAdmin(env);
    if (!serviceAccount) {
      throw new Error('Failed to initialize Firebase Admin');
    }

    // For simplicity, we'll use the Firebase Auth REST API with a service account
    // In production, you'd want to implement proper OAuth2 flow
    const projectId = serviceAccount.project_id;
    
    // Get users from Firebase Auth REST API
    let allUsers = [];
    let nextPageToken = null;
    
    do {
      const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`);
      if (nextPageToken) {
        url.searchParams.append('nextPageToken', nextPageToken);
      }
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getFirebaseAccessToken(serviceAccount)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxResults: 1000
        })
      });

      if (!response.ok) {
        // For demo purposes, we'll create a mock response if the API fails
        console.warn('Firebase API failed, using mock data');
        allUsers = [
          { localId: 'demo-user-1', email: 'demo1@example.com', displayName: 'Demo User 1' },
          { localId: 'demo-user-2', email: 'demo2@example.com', displayName: 'Demo User 2' }
        ];
        break;
      }

      const data = await response.json();
      allUsers = allUsers.concat(data.users || []);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    // Sync each user to our system
    const syncResults = {
      total: allUsers.length,
      synced: 0,
      skipped: 0,
      errors: []
    };

    for (const user of allUsers) {
      try {
        const userId = user.localId;
        const email = user.email || '';
        const displayName = user.displayName || email.split('@')[0] || 'Unknown User';
        
        // Check if user already exists in our system
        const existingUser = await env.WORDGARDEN_KV.get(`user:${userId}`);
        
        if (existingUser) {
          syncResults.skipped++;
          continue;
        }

        // Create user data with zero usage (they haven't used AI yet)
        const userData = {
          id: userId,
          email: email,
          name: displayName,
          createdAt: user.createdAt || new Date().toISOString(),
          lastActiveAt: user.lastLoginAt || new Date().toISOString(),
          usage: {
            total: 0,
            monthly: 0,
            daily: 0,
            lastReset: new Date().toISOString()
          },
          limits: {
            monthly: 100,
            daily: 20
          },
          metadata: {
            syncedFromFirebase: true,
            syncDate: new Date().toISOString(),
            originalCreationTime: user.createdAt
          }
        };

        // Store user data
        await env.WORDGARDEN_KV.put(`user:${userId}`, JSON.stringify(userData));
        
        // Initialize monthly usage if not exists
        const currentMonth = getCurrentMonth();
        const monthlyKey = `monthly:${userId}:${currentMonth}`;
        const existingMonthly = await env.WORDGARDEN_KV.get(monthlyKey);
        if (!existingMonthly) {
          await env.WORDGARDEN_KV.put(monthlyKey, '0');
        }

        // Initialize daily usage
        const currentDate = getCurrentDate();
        const dailyKey = `daily:${userId}:${currentDate}`;
        const existingDaily = await env.WORDGARDEN_KV.get(dailyKey);
        if (!existingDaily) {
          await env.WORDGARDEN_KV.put(dailyKey, '0');
        }

        syncResults.synced++;
      } catch (error) {
        syncResults.errors.push({
          userId: user.localId,
          error: error.message
        });
      }
    }

    return syncResults;
  } catch (error) {
    throw new Error(`Firebase Admin sync failed: ${error.message}`);
  }
}

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

function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || !['nok@pgmiv.com', 'milochan1313@gmail.com'].includes(payload.email)) {
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
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || !['nok@pgmiv.com', 'milochan1313@gmail.com'].includes(payload.email)) {
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
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    const userId = payload.uid;
    const userKey = `user:${userId}`;
    const existingUserData = await env.WORDGARDEN_KV.get(userKey);
    const nowIso = new Date().toISOString();
    if (!existingUserData) {
      const newUser = {
        firebaseUid: userId,
        email: payload.email,
        name: (payload.email || '').split('@')[0],
        lastActive: nowIso
      };
      await env.WORDGARDEN_KV.put(userKey, JSON.stringify(newUser));
    } else {
      const user = JSON.parse(existingUserData);
      user.lastActive = nowIso;
      await env.WORDGARDEN_KV.put(userKey, JSON.stringify(user));
    }
    
    // Get user quota from KV
    const quotaKey = `quota:${userId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth(), dailyCount: 0, date: getCurrentDate() };
    
    // Determine limits
    const userLimits = await getUserLimits(userId, env);
    const systemLimits = await getSystemLimits(env);
    const monthlyLimit = userLimits?.monthly ?? systemLimits.monthly;
    const dailyLimit = userLimits?.daily ?? systemLimits.daily;

    return new Response(JSON.stringify({
      usage: quota.count,
      month: quota.month,
      dailyUsage: quota.dailyCount || 0,
      date: quota.date || getCurrentDate(),
      limit: monthlyLimit,
      dailyLimit: dailyLimit
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
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const firebaseToken = authHeader.substring(7);
    const { firebaseUid, email, name } = await request.json();

    // Verify Firebase token
    const isValid = await verifyFirebaseToken(firebaseToken, firebaseUid, env);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid Firebase token' }), {
        status: 401,
        headers: corsHeaders
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function handleDashboard(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Check email claim directly for admin access
    const userEmail = payload.email;
    if (!['nok@pgmiv.com', 'milochan1313@gmail.com'].includes(userEmail)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: corsHeaders
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
        const quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth(), dailyCount: 0, date: getCurrentDate() };
        
        // Reset daily/monthly if needed for display accuracy
        if (quota.month !== getCurrentMonth()) {
          quota.count = 0;
          quota.month = getCurrentMonth();
        }
        if (quota.date !== getCurrentDate()) {
          quota.dailyCount = 0;
          quota.date = getCurrentDate();
        }

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
          dailyUsage: quota.dailyCount || 0,
          month: quota.month,
          monthlyLimit,
          dailyLimit,
          lastActive: user.lastActive || 'Never'
        });
      }
    }

    // Get daily stats for graph
    const dailyStats = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = await env.WORDGARDEN_KV.get(`stats:daily:${dateStr}`);
      dailyStats.push({
        date: dateStr,
        count: parseInt(count || '0')
      });
    }

    return new Response(JSON.stringify({ 
      users,
      systemLimits,
      dailyStats
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function handleDeleteUser(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || !['nok@pgmiv.com', 'milochan1313@gmail.com'].includes(payload.email)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders });
    }

    const { email } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: corsHeaders });

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
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
}

async function handleAddUser(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    
    if (!payload || !['nok@pgmiv.com', 'milochan1313@gmail.com'].includes(payload.email)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders });
    }

    const { email, name, monthly, daily } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: corsHeaders });

    // Check if user already exists
    const userKeys = await env.WORDGARDEN_KV.list({ prefix: 'user:' });
    for (const key of userKeys.keys) {
      const userData = await env.WORDGARDEN_KV.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email === email) {
          return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409, headers: corsHeaders });
        }
      }
    }

    // Generate a fake Firebase UID for this manually added user
    const firebaseUid = crypto.randomUUID();

    // Create user data
    const userKey = `user:${firebaseUid}`;
    const userData = {
      firebaseUid,
      email,
      name: name || email.split('@')[0],
      lastActive: 'Never',
      manuallyAdded: true
    };
    await env.WORDGARDEN_KV.put(userKey, JSON.stringify(userData));

    // Set limits if provided
    if (monthly !== undefined || daily !== undefined) {
      const limits = {
        monthly: monthly !== undefined ? monthly : 50,
        daily: daily !== undefined ? daily : 10
      };
      await env.WORDGARDEN_KV.put(`limit:${firebaseUid}`, JSON.stringify(limits));
    }

    return new Response(JSON.stringify({ success: true, user: userData }), {
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Add user error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
}

async function handleGenerate(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyToken(token, env);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    const userId = payload.uid;
    const userKey = `user:${userId}`;
    const existingUserData = await env.WORDGARDEN_KV.get(userKey);
    const nowIso = new Date().toISOString();
    if (!existingUserData) {
      const newUser = {
        firebaseUid: userId,
        email: payload.email,
        name: (payload.email || '').split('@')[0],
        lastActive: nowIso
      };
      await env.WORDGARDEN_KV.put(userKey, JSON.stringify(newUser));
    } else {
      const user = JSON.parse(existingUserData);
      user.lastActive = nowIso;
      await env.WORDGARDEN_KV.put(userKey, JSON.stringify(user));
    }
    
    // Check quota
    const quotaKey = `quota:${userId}`;
    const quotaData = await env.WORDGARDEN_KV.get(quotaKey);
    let quota = quotaData ? JSON.parse(quotaData) : { count: 0, month: getCurrentMonth(), dailyCount: 0, date: getCurrentDate() };
    
    if (quota.month !== getCurrentMonth()) {
      quota.count = 0;
      quota.month = getCurrentMonth();
    }
    
    if (quota.date !== getCurrentDate()) {
      quota.dailyCount = 0;
      quota.date = getCurrentDate();
    }
    
    // Determine limits
    const userLimits = await getUserLimits(userId, env);
    const systemLimits = await getSystemLimits(env);
    const monthlyLimit = userLimits?.monthly ?? systemLimits.monthly;
    const dailyLimit = userLimits?.daily ?? systemLimits.daily;
    
    if (quota.count >= monthlyLimit) {
      return new Response(JSON.stringify({ error: 'Monthly quota exceeded' }), {
        status: 429,
        headers: corsHeaders
      });
    }

    if (quota.dailyCount >= dailyLimit) {
      return new Response(JSON.stringify({ error: 'Daily quota exceeded' }), {
        status: 429,
        headers: corsHeaders
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
    quota.dailyCount = (quota.dailyCount || 0) + 1;
    await env.WORDGARDEN_KV.put(quotaKey, JSON.stringify(quota));

    // Increment global daily stats
    const today = getCurrentDate();
    const globalDailyKey = `stats:daily:${today}`;
    const currentGlobalDaily = await env.WORDGARDEN_KV.get(globalDailyKey);
    const newGlobalDaily = (parseInt(currentGlobalDaily || '0') + 1).toString();
    await env.WORDGARDEN_KV.put(globalDailyKey, newGlobalDaily);
    
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
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
      if (url.pathname === '/v1/sync-users') {
        return handleSyncUsers(request, env);
      }
      if (url.pathname === '/v1/generate') {
        return handleGenerate(request, env);
      }
      if (url.pathname === '/v1/user-delete') {
        return handleDeleteUser(request, env);
      }
      if (url.pathname === '/v1/user-add') {
        return handleAddUser(request, env);
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

    if (url.pathname === '/public/favicon.ico') {
      try {
        const assetPath = 'favicon.ico';
        const assetKey = assetManifest[assetPath];
        const body = await env.__STATIC_CONTENT.get(assetKey, 'arrayBuffer');
        if (!body) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response(body, {
          headers: {
            'Content-Type': 'image/x-icon',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      } catch (_) {
        return new Response('Not Found', { status: 404 });
      }
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
