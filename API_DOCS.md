# API Documentation

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

### POST /v1/exchange-token

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