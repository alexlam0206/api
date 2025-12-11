# Quick Reference: Required Secrets

## Overview
Your WordGarden API requires 2 secrets to be set via wrangler CLI or Cloudflare UI:

## Required Secrets

### 1. JWT_SECRET
- **Purpose**: Secure token signing for user authentication
- **Format**: Random string, minimum 32 characters
- **Generate**: `openssl rand -base64 32`
- **Set via CLI**: `npx wrangler secret put JWT_SECRET`

### 2. FIREBASE_API_KEY
- **Purpose**: Verify Firebase tokens during user authentication
- **Format**: Firebase Web API Key (looks like: `AIzaSy...`)
- **Get from**: Firebase Console → Project Settings → General → Web API Key
- **Set via CLI**: `npx wrangler secret put FIREBASE_API_KEY`

## Quick Commands
```bash
# Set both secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put FIREBASE_API_KEY

# Deploy after setting secrets
npx wrangler deploy
```

## Environment-Specific Secrets
- Development: Set in main worker
- Production: Set in production environment with `--env production`

## Security Notes
- Never commit secrets to git
- Use strong, unique secrets for each environment
- Rotate secrets regularly for security