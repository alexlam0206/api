# WordGarden Cloudflare Worker

A Cloudflare Worker backend for WordGarden that provides AI text generation with user quota management.

## Features

- **AI Text Generation**: Uses Cloudflare Workers AI with Llama 3.1 8B Instruct model
- **User Quota Management**: 50 requests per month per user
- **Firebase Integration**: Secure token exchange system for Firebase-authenticated users
- **Rate Limiting**: Prevents quota abuse with proper error handling

## API Endpoints

### POST /v1/generate

Generate text using the AI model.

**Headers:**
```
Authorization: Bearer <cloudflare_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "Write a poem about gardens",
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "result": "Generated text here..."
}
```

**Error Responses:**
- `401`: Missing or invalid authorization
- `429`: Monthly quota exceeded
- `400`: Missing prompt or invalid request
- `500`: Internal server error

### POST /api/exchange-token

Exchange Firebase token for Cloudflare token.

**Headers:**
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firebaseUid": "user123",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "token": "cloudflare_jwt_token",
  "expiresIn": 3600
}
```

## Quick Setup

### 1. Install Dependencies
```bash
npm install -g wrangler
```

### 2. Create KV Namespaces
```bash
npx wrangler kv:namespace create "WORDGARDEN_KV"
npx wrangler kv:namespace create "WORDGARDEN_KV" --preview
```

### 3. Set Secrets
```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set secrets in Cloudflare
npx wrangler secret put JWT_SECRET
npx wrangler secret put FIREBASE_API_KEY
```

**Get Firebase API Key:** Firebase Console → Project Settings → General → Web API Key

### 4. Update wrangler.jsonc
Replace KV namespace IDs in `wrangler.jsonc` with your actual IDs from step 2.

### 5. Deploy
```bash
npx wrangler deploy
```

## Frontend Integration

```javascript
import { WordGardenAPI } from './firebase-integration.js';

const wordGarden = new WordGardenAPI();

// Generate text
const result = await wordGarden.generateText('Write about gardens');
console.log(result);
```

## Quota System

- Each user gets 50 requests per calendar month
- Quota resets automatically on month change
- Quota data stored in Cloudflare KV with 35-day TTL

## Testing

```bash
# Test token exchange
curl -X POST https://your-worker.workers.dev/api/exchange-token \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firebaseUid": "user123", "email": "user@example.com"}'

# Test AI generation
curl -X POST https://your-worker.workers.dev/v1/generate \
  -H "Authorization: Bearer YOUR_CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello world"}'
```

## Monitoring

```bash
# View logs
npx wrangler tail

# Check KV storage
npx wrangler kv:key get "quota:USER_ID" --binding WORDGARDEN_KV
```

## Security

- JWT token validation with 1-hour expiration
- HTTPS enforcement
- Rate limiting on token exchange
- Secrets managed via `wrangler secret put`
- No secrets committed to code

## Repository

This repo is public and safe - all secrets are stored in Cloudflare, not in code.

## Useful Commands

```bash
# Deploy to production
npx wrangler deploy --env production

# Update secrets
npx wrangler secret put JWT_SECRET --env production

# List KV keys
npx wrangler kv:key list --binding WORDGARDEN_KV
```

## Troubleshooting

**"Invalid Firebase token"** - Check Firebase API key and token validity

**"JWT verification failed"** - Verify JWT secret is set correctly

**"Quota exceeded"** - Check KV storage for user data

**AI generation fails** - Ensure Workers AI is enabled in your Cloudflare account