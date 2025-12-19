import { useEffect, useState } from 'react'
import { auth } from './firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, LogOut } from 'lucide-react'
import { ModeToggle } from './components/mode-toggle'

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-2">
           <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
           <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen bg-background text-foreground">
         <Dashboard />
      </div>
    );
  }

  if (user && user.email && !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-background text-foreground relative">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <div className="max-w-md w-full space-y-4 text-center">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You are logged in as <span className="font-semibold">{user.email}</span>, but you are not an authorized admin.
              </AlertDescription>
            </Alert>
            
            <Button onClick={() => auth.signOut()} variant="outline" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
            </Button>
        </div>
      </div>
    )
  }

  return <Login />;
}

export default App
