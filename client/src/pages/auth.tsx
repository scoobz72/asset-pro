import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/Logo";
import { ShieldCheck, Mail, Key } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useLogin } from "@/hooks/use-auth";

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const login = useLogin();
  const isLoading = login.isPending;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    login.mutate(
      { email, password },
      {
        onSuccess: () => onLogin(),
        onError: (err: Error) => {
          if (err.message.startsWith("401")) setLoginError("Invalid email or password.");
          else if (err.message.startsWith("403")) setLoginError("This company's account is suspended. Please contact support.");
          else setLoginError("Sign in failed. Please try again.");
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]" />

      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
          ← Back to Home
        </Button>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <h1><LogoFull className="text-4xl" /></h1>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pt-6">
            <CardTitle className="text-2xl text-center">Sign in</CardTitle>
            <CardDescription className="text-center">
              Use the email and password your company gave you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Forgotten your password? Ask your company's manager to reset it.</p>
              </div>

              {loginError && (
                <p className="text-sm text-destructive" role="alert" data-testid="text-login-error">{loginError}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-sign-in">
                {isLoading ? "Verifying..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center text-center justify-center border-t border-border/50 bg-muted/20 py-4 mt-2 rounded-b-lg">
            <ShieldCheck className="size-4 text-green-500 mb-2" />
            <p className="text-xs text-muted-foreground">
              Each company's data is kept separate. You only ever see your own company.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              New to myCMMS? <a href="/#request-access" className="text-primary hover:underline font-medium">Request access</a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
