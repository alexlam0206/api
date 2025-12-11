# WordGarden Cloudflare Worker

A secure Cloudflare Worker backend for WordGarden AI with Firebase authentication integration.

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Update `wrangler.toml` with your KV namespace IDs
   - Set your Firebase API key and JWT secret

3. **Deploy**
   ```bash
   npm run deploy
   ```

## 📁 Project Structure

```
├── src/
│   └── index.js              # Main Cloudflare Worker
├── frontend/
│   ├── firebase-integration.js  # Frontend integration
│   └── README.md            # Frontend setup guide
├── wrangler.toml           # Cloudflare configuration
├── package.json            # Dependencies
├── README.md              # Main documentation
├── FIREBASE_SYNC.md       # Firebase integration guide
└── DEPLOYMENT_CHECKLIST.md # Deployment steps
```

## 🔧 Configuration

### Environment Variables

Set these securely in Cloudflare:
- `JWT_SECRET`: 32+ character secure key
- `FIREBASE_API_KEY`: Your Firebase Web API key

### KV Namespaces

Create KV namespaces for quota storage:
```bash
npx wrangler kv:namespace create WORDGARDEN_KV
```

## 🔗 API Endpoints

### POST /api/exchange-token
Exchange Firebase token for Cloudflare token.

### POST /v1/generate
Generate text with AI (requires Cloudflare token).

## 🛡️ Security Features

- JWT token validation
- Firebase token verification
- HTTPS enforcement
- Rate limiting
- Secure secret management
- Short-lived tokens (1 hour)

## 📊 Quota System

- 50 requests per user per month
- Automatic monthly reset
- KV-based storage
- Real-time tracking

## 🔗 Firebase Integration

See [FIREBASE_SYNC.md](FIREBASE_SYNC.md) for complete integration guide.

## 🚀 Deployment

Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for step-by-step deployment.

## 📝 License

MIT License - see LICENSE file for details.