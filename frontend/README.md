# Frontend Integration Guide

This guide shows how to integrate Firebase authentication with WordGarden in your frontend application.

## Installation

```bash
npm install firebase jose
```

## Setup

1. **Copy the integration file** to your project:
   ```bash
   cp frontend/firebase-integration.js your-project/src/
   ```

2. **Update Firebase configuration** in the file with your project details:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-firebase-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     // ... rest of your config
   };
   ```

3. **Update Cloudflare Worker URL**:
   ```javascript
   this.baseUrl = 'https://your-worker.workers.dev'; // Replace with your actual worker URL
   ```

## Usage Examples

### Basic Usage

```javascript
import { WordGardenAPI } from './firebase-integration.js';

const wordGarden = new WordGardenAPI();

// Generate text
async function createContent() {
  try {
    const result = await wordGarden.generateText('Write a poem about gardens');
    console.log('Generated:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### React Component

```javascript
import { useWordGarden } from './firebase-integration.js';

function MyComponent() {
  const { generateText, loading, error, quotaStatus } = useWordGarden();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');

  const handleGenerate = async () => {
    try {
      const text = await generateText(prompt);
      setResult(text);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <div>
      {quotaStatus?.exceeded && (
        <div className="quota-warning">
          Monthly quota exceeded. Please try again next month.
        </div>
      )}
      
      <textarea 
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt..."
      />
      
      <button onClick={handleGenerate} disabled={loading || quotaStatus?.exceeded}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
      
      {result && <div className="result">{result}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Authentication Setup

```javascript
import { AuthProvider } from './firebase-integration.js';

function App() {
  return (
    <AuthProvider>
      <YourMainComponent />
    </AuthProvider>
  );
}
```

## API Reference

### WordGardenAPI Class

#### `generateText(prompt, options)`
Generate text using the AI model.

**Parameters:**
- `prompt` (string): The text prompt for generation
- `options` (object, optional):
  - `maxTokens` (number): Maximum tokens to generate (default: 512)
  - `temperature` (number): Creativity level 0-1 (default: 0.7)

**Returns:** Promise<string> - The generated text

**Throws:**
- `Error: User not authenticated` - If user is not logged in
- `Error: Monthly quota exceeded` - If user has used all 50 requests
- `Error: API request failed` - For other API errors

#### `getQuotaStatus()`
Check current quota status.

**Returns:** Promise<Object> - `{ exceeded: boolean, remaining: number }`

### React Hooks

#### `useWordGarden()`
Hook for using WordGarden in React components.

**Returns:**
```javascript
{
  generateText,    // Function to generate text
  checkQuota,      // Function to check quota status
  loading,         // Boolean for loading state
  error,           // String error message
  quotaStatus      // Object with quota info
}
```

## Error Handling

The API handles various error scenarios:

```javascript
try {
  const result = await wordGarden.generateText('My prompt');
} catch (error) {
  switch (error.message) {
    case 'User not authenticated':
      // Redirect to login
      break;
    case 'Monthly quota exceeded':
      // Show quota exceeded message
      break;
    case 'API request failed':
      // Show generic error message
      break;
    default:
      // Handle other errors
  }
}
```

## Security Notes

- Tokens are automatically refreshed when expired
- All API calls use HTTPS
- Firebase tokens are verified server-side
- Cloudflare tokens are short-lived (1 hour)

## Testing

```javascript
// Test quota check
const quota = await wordGarden.getQuotaStatus();
console.log('Quota exceeded:', quota.exceeded);

// Test generation
const result = await wordGarden.generateText('Hello world');
console.log('Generated:', result);
```