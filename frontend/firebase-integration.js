// Firebase + WordGarden Integration 

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "your-firebase-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class WordGardenAPI {
  constructor() {
    this.cloudflareToken = null;
    this.tokenExpiry = null;
    this.baseUrl = 'https://your-worker.workers.dev'; // Replace with your worker URL
  }

  /**
   * Get a valid Cloudflare token, exchanging Firebase token if needed
   */
  async getValidToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Check if existing token is still valid (with 5min buffer)
    if (this.cloudflareToken && this.tokenExpiry && this.tokenExpiry > Date.now() + 300000) {
      return this.cloudflareToken;
    }

    // Get new Firebase ID token
    const firebaseToken = await getIdToken(user, true); // force refresh
    
    // Exchange for Cloudflare token
    const response = await fetch(`${this.baseUrl}/api/exchange-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
        email: user.email
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange token');
    }

    const { cloudflareToken, expiresIn } = await response.json();
    this.cloudflareToken = cloudflareToken;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    
    return cloudflareToken;
  }

  /**
   * Generate text using WordGarden AI
   */
  async generateText(prompt, options = {}) {
    const token = await this.getValidToken();
    
    const response = await fetch(`${this.baseUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        max_tokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7
      })
    });

    if (response.status === 429) {
      throw new Error('Monthly quota exceeded');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  /**
   * Check current quota status
   */
  async getQuotaStatus() {
    try {
      const token = await this.getValidToken();
      
      // Make a test request to check quota
      const response = await fetch(`${this.baseUrl}/v1/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'test',
          max_tokens: 1
        })
      });

      if (response.status === 429) {
        return { exceeded: true, remaining: 0 };
      }

      // If successful, we know quota is available
      return { exceeded: false, remaining: 'unknown' }; // You could enhance this to return actual count
    } catch (error) {
      if (error.message === 'Monthly quota exceeded') {
        return { exceeded: true, remaining: 0 };
      }
      throw error;
    }
  }
}

// React Hook for WordGarden API
export function useWordGarden() {
  const [api] = useState(() => new WordGardenAPI());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState(null);

  const generateText = useCallback(async (prompt, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await api.generateText(prompt, options);
      return result.result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const checkQuota = useCallback(async () => {
    try {
      const status = await api.getQuotaStatus();
      setQuotaStatus(status);
      return status;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [api]);

  return {
    generateText,
    checkQuota,
    loading,
    error,
    quotaStatus
  };
}

// Example React Component
export function WordGardenComponent() {
  const { generateText, checkQuota, loading, error, quotaStatus } = useWordGarden();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    try {
      const generatedText = await generateText(prompt);
      setResult(generatedText);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  return (
    <div className="word-garden-container">
      <h2>WordGarden AI</h2>
      
      {quotaStatus?.exceeded && (
        <div className="quota-warning">
          Monthly quota exceeded. Please try again next month.
        </div>
      )}
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt here..."
        rows={4}
        disabled={quotaStatus?.exceeded}
      />
      
      <button 
        onClick={handleGenerate} 
        disabled={loading || quotaStatus?.exceeded || !prompt.trim()}
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
      
      {result && (
        <div className="result-container">
          <h3>Generated Text:</h3>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}

// Firebase Authentication Wrapper
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email, password) => {
    return await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    return await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Usage Example
export function App() {
  return (
    <AuthProvider>
      <div className="app">
        <AuthStatus />
        <WordGardenComponent />
      </div>
    </AuthProvider>
  );
}

function AuthStatus() {
  const { user, loading, signOut } = useContext(AuthContext);
  
  if (loading) return <div>Loading...</div>;
  
  if (!user) return <div>Please sign in to use WordGarden</div>;
  
  return (
    <div>
      Signed in as {user.email}
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}