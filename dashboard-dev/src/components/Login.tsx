import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ModeToggle } from "./mode-toggle";

const ADMIN_EMAILS = ["nok@pgmiv.com", "milochan1313@gmail.com"];

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
        await auth.signOut();
        setError("Access denied. Only authorized admin accounts can sign in.");
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">WordGarden Admin</CardTitle>
          <CardDescription>Sign in to manage the application</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )} 
          <Button onClick={handleLogin} className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
            )}
            {loading ? "Signing in..." : "Continue with Google"}
          </Button>
          <div className="text-center text-sm text-muted-foreground mt-4">
            Not admin? Visit <a href="https://wordgarden.web.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium transition-colors">WordGarden</a> to use the app, or check the <a href="https://github.com/alexlam0206/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium transition-colors">GitHub Repo</a>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


