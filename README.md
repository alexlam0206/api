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

## Setup

### 1. Install Dependencies

```bash
npm install -g wrangler
```

### 2. Configure Environment

Create a KV namespace:
```bash
wrangler kv:namespace create "WORDGARDEN_KV"
wrangler kv:namespace create "WORDGARDEN_KV" --preview
```

Update `wrangler.toml` with your KV namespace IDs.

### 3. Deploy

```bash
wrangler deploy
```

## Firebase Integration

See [FIREBASE_SYNC.md](FIREBASE_SYNC.md) for detailed instructions on synchronizing Firebase user IDs with Cloudflare tokens.

### Quick Setup

1. **Token Exchange**: Your frontend exchanges Firebase tokens for Cloudflare tokens
2. **User Mapping**: Firebase UID becomes the user ID for quota tracking
3. **Secure Flow**: All token exchanges happen server-side

## Quota System

- Each user gets 50 requests per calendar month
- Quota resets automatically on month change
- Quota data stored in Cloudflare KV with 35-day TTL
- Monthly format: `YYYY-MM`

## Security

- JWT token validation
- HTTPS enforcement
- Rate limiting on token exchange
- Secure secret management
- Short-lived tokens (1 hour)

## Environment Variables

Add to `wrangler.toml`:

```toml
[env.production.vars]
JWT_SECRET = "your-secure-jwt-secret"
FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

## Testing

```bash
# Test with curl (after getting a valid token)
curl -X POST https://your-worker.workers.dev/v1/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello world"}'
```

## Monitoring

Check KV storage:
```bash
wrangler kv:key get "quota:USER_ID" --binding WORDGARDEN_KV
```

View worker logs:
```bash
wrangler tail
```