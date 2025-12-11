# 🔧 Setting Secrets in Cloudflare UI - Step by Step

## Method 1: Cloudflare Dashboard UI

### Step 1: Navigate to Your Worker
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages** in the left sidebar
3. Find your worker named **"api"** (or "wordgarden-worker")
4. Click on it to open the worker details

### Step 2: Go to Settings
1. Click the **Settings** tab at the top
2. Scroll down to the **Variables** section

### Step 3: Add JWT_SECRET
1. Click **Add variable** button
2. **Variable name**: `JWT_SECRET`
3. **Value**: Paste your generated secret (32+ characters)
4. **Secret**: ✅ **CHECK THIS BOX** (very important!)
5. Click **Save**

### Step 4: Add FIREBASE_API_KEY
1. Click **Add variable** button again
2. **Variable name**: `FIREBASE_API_KEY`
3. **Value**: Paste your Firebase Web API key (starts with `AIzaSy...`)
4. **Secret**: ✅ Check this box too
5. Click **Save**

## 🖥️ Visual Guide

```
Cloudflare Dashboard → Workers & Pages → api → Settings → Variables

[JWT_SECRET] [************************] [Encrypted] ✓
[FIREBASE_API_KEY] [AIzaSy...] [Encrypted] ✓

[Add variable] [Deploy] [Save]
```

## ✅ What You Should See

After adding secrets, you should see:
- Variable names: `JWT_SECRET` and `FIREBASE_API_KEY`
- Values: Hidden (show as asterisks or "Encrypted")
- Status: ✅ Encrypted/Secret

## 🚨 Important Notes

1. **Always check "Secret" box** - This encrypts the value
2. **Values are hidden** - You won't see them after saving
3. **Changes require deployment** - Click "Deploy" to apply
4. **Different per environment** - Set separately for dev/prod

## 🔍 Verification

### Check in UI:
- Variables show as **[Encrypted]**
- Values are hidden with asterisks
- No error messages in red

### Test Deployment:
```bash
npx wrangler deploy
# Should succeed without "missing secret" errors
```

## 🛠️ Troubleshooting

### "Missing secret" error:
- Secret wasn't marked as "Secret" 
- Variable name is misspelled
- Secret wasn't deployed

### "Invalid Firebase token" error:
- Wrong Firebase API key (use Web API key, not server key)
- Firebase Authentication not enabled in Firebase Console

### Can't see Variables section:
- Make sure you're in worker settings, not account settings
- Check you have proper permissions

## 🚀 Next Step

After setting secrets, deploy your worker:
```bash
npx wrangler deploy
```

Your WordGarden API will now have secure access to both secrets!