import { useEffect, useState } from 'react'
import { auth } from './firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Admin check
  if (user && user.email === "nok@pgmiv.com") {
    return <Dashboard />;
  }

  // If user is logged in but not admin, show login with error (handled in Login component if we pass prop or manage state there, but for now simple logout if not admin in Login component is better, or here)
  // Actually Login component handles the sign in. If user is already signed in but not admin, we should probably show "Access Denied" or just the Login screen again (and sign them out).
  
  if (user && user.email !== "nok@pgmiv.com") {
      // For simplicity, let's just render Login which will check and show error if needed, or we can force sign out here.
      // But better to just show "Not Authorized" screen.
      return (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
              <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
              <p>You are logged in as {user.email}, but you are not an admin.</p>
              <button onClick={() => auth.signOut()} className="px-4 py-2 bg-blue-600 text-white rounded">Sign Out</button>
          </div>
      )
  }

  return <Login />;
}

export default App
