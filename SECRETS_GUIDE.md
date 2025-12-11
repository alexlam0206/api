# 🔐 Getting Secrets for WordGarden API

## 1. Firebase API Key

### From Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the **⚙️ Settings** (gear) icon → **Project Settings**
4. In **General** tab, scroll down to **Your apps** section
5. Find your **Web app** (or create one if needed)
6. Copy the **API Key** (it looks like: `AIzaSy...`)

### Important:
- Use the **Web API Key**, NOT the server key
- This is safe to use in Cloudflare Workers (it's a public key)

## 2. JWT Secret

### Generate a Secure Secret:
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Online generator (use carefully)
# https://generate-secret.vercel.app/
```

### Requirements:
- **Minimum 32 characters** (64+ recommended)
- **Random and unpredictable**
- **Store securely** - this is your private key

### Example Secure Secret:
```
7f8a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

## 3. Setting Secrets in Cloudflare

### Method 1: Cloudflare UI
1. Go to **Workers & Pages** → **Your Worker** (`api`)
2. Click **Settings** tab
3. Scroll to **Variables**
4. Click **Add variable**
5. Add:
   - **Variable name**: `JWT_SECRET`
   - **Value**: Your generated secret
   - **Secret**: ✅ Check this box
6. Repeat for `FIREBASE_API_KEY`

### Method 2: Wrangler CLI (Recommended)
```bash
# Set JWT Secret
npx wrangler secret put JWT_SECRET
# You'll be prompted to enter the value

# Set Firebase API Key
npx wrangler secret put FIREBASE_API_KEY
# Enter your Firebase web API key

# For production environment
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put FIREBASE_API_KEY --env production
```

## 4. Verify Secrets Are Set

### Check via CLI:
```bash
# List all secrets
npx wrangler secret list

# Test deployment
npx wrangler deploy
```

### Check via UI:
- Go to your worker settings
- Variables should show as **Encrypted**

## 🔒 Security Best Practices

1. **Never commit secrets to git**
2. **Use different secrets for dev/prod**
3. **Rotate secrets regularly**
4. **Use strong, random secrets**
5. **Never share JWT secret**

## 🚀 Quick Commands

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set both secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put FIREBASE_API_KEY

# Deploy
npx wrangler deploy
```

## 📋 Secret Summary

| Secret | Purpose | Source | Security Level |
|--------|---------|---------|-----------------|
| `JWT_SECRET` | Sign JWT tokens | Generate yourself | 🔴 Private |
| `FIREBASE_API_KEY` | Verify Firebase tokens | Firebase Console | 🟡 Public |

Once you have both secrets set, your WordGarden API will be ready to authenticate users and track quotas!