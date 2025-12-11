# 🚀 WordGarden Cloudflare Worker - Deployment Checklist

## Pre-Deployment Setup

### 1. Cloudflare Account Setup
- [ ] Create Cloudflare account (if not already)
- [ ] Enable Workers AI in your account
- [ ] Create KV namespace for quota storage

### 2. Firebase Setup
- [ ] Get Firebase Web API Key from Firebase Console
- [ ] Ensure Firebase Authentication is enabled
- [ ] Note your Firebase Project ID

### 3. Local Environment Setup
```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create KV namespaces
npx wrangler kv:namespace create "WORDGARDEN_KV"
npx wrangler kv:namespace create "WORDGARDEN_KV" --preview
```

## Configuration Steps

### 1. Update wrangler.toml
Replace placeholder values in `wrangler.toml`:
```toml
# Development
[[kv_namespaces]]
binding = "WORDGARDEN_KV"
id = "your-dev-kv-namespace-id"          # ← Replace with actual ID
preview_id = "your-preview-kv-namespace-id" # ← Replace with actual ID

# Production
[[env.production.kv_namespaces]]
binding = "WORDGARDEN_KV"
id = "your-production-kv-namespace-id"    # ← Replace with actual ID

# Environment variables
[env.production.vars]
JWT_SECRET = "your-secure-jwt-secret-at-least-32-characters-long"  # ← Generate secure key
FIREBASE_API_KEY = "your-firebase-web-api-key"                     # ← From Firebase Console
```

### 2. Generate Secure JWT Secret
```bash
# Generate a secure 32+ character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Environment Variables (Production)
```bash
# Set secrets in Cloudflare (more secure than wrangler.toml)
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put FIREBASE_API_KEY --env production
```

## Deployment Commands

### Development Deployment
```bash
# Deploy to development environment
npx wrangler deploy --env development

# Or just
npx wrangler deploy
```

### Production Deployment
```bash
# Deploy to production environment
npx wrangler deploy --env production
```

## Post-Deployment Verification

### 1. Test Token Exchange Endpoint
```bash
# Test with curl (replace with your actual Firebase token)
curl -X POST https://your-worker.workers.dev/api/exchange-token \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firebaseUid": "user123", "email": "user@example.com"}'
```

### 2. Test AI Generation Endpoint
```bash
# Test with the Cloudflare token you got from exchange
curl -X POST https://your-worker.workers.dev/v1/generate \
  -H "Authorization: Bearer YOUR_CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello world"}'
```

### 3. Monitor Logs
```bash
# Watch real-time logs
npx wrangler tail --env production
```

## Frontend Integration

### 1. Update Frontend Configuration
In your frontend code, update the base URL:
```javascript
// In firebase-integration.js
this.baseUrl = 'https://your-actual-worker.workers.dev';
```

### 2. Install Dependencies
```bash
npm install firebase jose
```

### 3. Test Frontend Integration
```javascript
import { WordGardenAPI } from './firebase-integration.js';

const wordGarden = new WordGardenAPI();

// Test the flow
async function testIntegration() {
  try {
    const result = await wordGarden.generateText('Test prompt');
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Security Checklist

- [ ] JWT secret is at least 32 characters
- [ ] Environment variables are set via `wrangler secret put` (not in code)
- [ ] Firebase API key is the Web API key (not server key)
- [ ] Worker URL uses HTTPS
- [ ] KV namespaces are properly configured
- [ ] Production and development environments are separate

## Monitoring & Maintenance

### Regular Checks
- [ ] Monitor worker logs for errors
- [ ] Check KV storage usage
- [ ] Verify quota system is working
- [ ] Test token exchange periodically

### Useful Commands
```bash
# Check KV storage
npx wrangler kv:key list --binding WORDGARDEN_KV

# View worker analytics
npx wrangler tail

# Update secrets
npx wrangler secret put JWT_SECRET --env production
```

## Troubleshooting

### Common Issues

1. **"Invalid Firebase token"**
   - Verify Firebase API key is correct
   - Check Firebase token is valid and not expired
   - Ensure Firebase Authentication is enabled

2. **"JWT verification failed"**
   - Check JWT secret is correctly set
   - Verify token hasn't expired (1 hour lifetime)

3. **"Quota exceeded" errors**
   - Check KV storage for user data
   - Verify quota reset logic is working

4. **AI generation fails**
   - Ensure Workers AI is enabled in your account
   - Check model availability: `@cf/meta/llama-3.1-8b-instruct`

### Debug Mode
```bash
# Enable debug logging
DEBUG=true npx wrangler tail
```

## Push to Private Repository

```bash
# Initialize git (if not already)
git init

# Add files
git add .
git commit -m "Initial WordGarden Cloudflare Worker deployment"

# Add your private repo
git remote add origin https://github.com/yourusername/your-private-repo.git

# Push
git push -u origin main
```

## Next Steps

- [ ] Set up monitoring alerts
- [ ] Implement usage analytics
- [ ] Add more AI models
- [ ] Consider implementing webhooks for quota notifications
- [ ] Add admin endpoints for quota management

## Support

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Firebase Docs: https://firebase.google.com/docs
- Workers AI: https://developers.cloudflare.com/workers-ai/