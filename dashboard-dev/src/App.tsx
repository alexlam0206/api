import { useEffect, useState } from 'react'
import { auth } from './firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'

const ADMIN_EMAILS = ["nok@pgmiv.com", "milochan1313@gmail.com"]

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

  if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
    return <Dashboard />;
  }

  if (user && user.email && !ADMIN_EMAILS.includes(user.email)) {
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
