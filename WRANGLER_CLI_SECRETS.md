# ⚡ Setting Secrets via Wrangler CLI (Recommended)

## Quick Commands

```bash
# Navigate to your project directory
cd /Users/nok/Desktop/WordGarden/api

# Set JWT Secret (you'll be prompted to enter the value)
npx wrangler secret put JWT_SECRET

# Set Firebase API Key (you'll be prompted to enter the value)  
npx wrangler secret put FIREBASE_API_KEY

# Deploy with secrets
npx wrangler deploy
```

## 🔧 Detailed Steps

### Step 1: Generate JWT Secret First
```bash
# Generate a secure 64-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output (save it somewhere safe)
# Example: 7f8a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Step 2: Set JWT Secret
```bash
npx wrangler secret put JWT_SECRET

# You'll see:
# ✔ Enter a secret value: › 
# Paste your generated secret here
# ✔ Success: Secret "JWT_SECRET" was created
```

### Step 3: Set Firebase API Key
```bash
npx wrangler secret put FIREBASE_API_KEY

# You'll see:
# ✔ Enter a secret value: › 
# Paste your Firebase Web API key (AIzaSy...)
# ✔ Success: Secret "FIREBASE_API_KEY" was created
```

### Step 4: Verify Secrets
```bash
# List all secrets to confirm
npx wrangler secret list

# Should show:
# [
#   {
#     "name": "FIREBASE_API_KEY",
#     "type": "secret_text"
#   },
#   {
#     "name": "JWT_SECRET", 
#     "type": "secret_text"
#   }
# ]
```

### Step 5: Deploy
```bash
# Deploy your worker with secrets
npx wrangler deploy

# Should show success message with your worker URL
```

## 🎯 Interactive Example

```bash
$ npx wrangler secret put JWT_SECRET
✔ Enter a secret value: › ****************************************************************
✔ Success: Secret "JWT_SECRET" was created

$ npx wrangler secret put FIREBASE_API_KEY  
✔ Enter a secret value: › AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
✔ Success: Secret "FIREBASE_API_KEY" was created

$ npx wrangler deploy
🚀 Building...
🚀 Uploading...
✨ Success! Deployed api to https://api.your-subdomain.workers.dev
```

## 🚨 Production Environment

If you have production environment configured:

```bash
# Set secrets for production
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put FIREBASE_API_KEY --env production

# Deploy to production
npx wrangler deploy --env production
```

## 🔍 Troubleshooting

### "wrangler: command not found"
```bash
# Install wrangler globally
npm install -g wrangler

# Or use npx
npx wrangler secret put JWT_SECRET
```

### "Authentication error"
```bash
# Login to Cloudflare first
npx wrangler login
# Then try setting secrets again
```

### "Secret already exists"
```bash
# Delete and recreate
npx wrangler secret delete JWT_SECRET
npx wrangler secret put JWT_SECRET
```

## ✅ Benefits of CLI Method

- **More secure** - No secrets in browser history
- **Scriptable** - Can be automated
- **Version control** - Part of your deployment process
- **Cross-platform** - Works on any OS
- **Encrypted transmission** - Secrets sent securely to Cloudflare

## 🚀 One-Command Setup

Here's everything in one go:

```bash
# Generate JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Generated JWT Secret: $JWT_SECRET"

# Set secrets (you'll still be prompted for Firebase API key)
npx wrangler secret put JWT_SECRET << EOF
$JWT_SECRET
EOF

echo "Now enter your Firebase Web API key when prompted..."
npx wrangler secret put FIREBASE_API_KEY

# Deploy
npx wrangler deploy
```

After this, your WordGarden API will be fully configured with secure secrets!