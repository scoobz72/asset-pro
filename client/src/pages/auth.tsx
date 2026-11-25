import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ShieldCheck, Mail, Key, Building2, User, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useLogin } from "@/hooks/use-auth";

export default function Auth({ onLogin, defaultTab = "login" }: { onLogin: (companyName?: string) => void, defaultTab?: string }) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
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
          setLoginError(err.message.startsWith("401") ? "Invalid email or password." : "Sign in failed. Please try again.");
        },
      },
    );
  };

  const handleSsoLogin = () => {
    setLoginError("Single sign-on is not configured for this workspace. Sign in with your email and password.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("Self-service workspace registration is not available. Ask your administrator to create an account for you.");
  };

  const subdomain = companyName 
    ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + ".promaintain.app"
    : "yourcompany.promaintain.app";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Abstract industrial background elements */}
      <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]" />
      
      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
          ← Back to Home
        </Button>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="size-12 rounded-xl bg-primary flex items-center justify-center shadow-lg mb-4">
             <Wrench className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ProMaintain</h1>
          <p className="text-muted-foreground mt-2 font-medium">Single Tenant Environment</p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-xl">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none rounded-t-lg h-14">
              <TabsTrigger value="login" className="data-[state=active]:bg-background h-full rounded-none">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-background h-full rounded-none">Register Company</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="m-0">
              <CardHeader className="space-y-1 pt-6">
                <CardTitle className="text-2xl text-center">Secure Access</CardTitle>
                <CardDescription className="text-center">
                  Enter your credentials to access your CMMS
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <a href="#" className="text-xs text-primary hover:underline font-medium">
                        Forgot password?
                      </a>
                    </div>
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
                  </div>
                  
                  {loginError && (
                    <p className="text-sm text-destructive" role="alert" data-testid="text-login-error">{loginError}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-sign-in">
                    {isLoading ? "Verifying..." : "Sign In"}
                  </Button>
                </form>

                <div className="my-6 flex items-center gap-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground font-medium uppercase">Or continue with</span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" type="button" onClick={handleSsoLogin} className="bg-background">
                    <svg className="mr-2 size-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                    Google
                  </Button>
                  <Button variant="outline" type="button" onClick={handleSsoLogin} className="bg-background">
                    <svg className="mr-2 size-4" viewBox="0 0 21 21">
                      <path d="M0 0h10v10H0z" fill="#f25022"/>
                      <path d="M11 0h10v10H11z" fill="#7fba00"/>
                      <path d="M0 11h10v10H0z" fill="#00a4ef"/>
                      <path d="M11 11h10v10H11z" fill="#ffb900"/>
                    </svg>
                    Microsoft
                  </Button>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="register" className="m-0">
              <CardHeader className="space-y-1 pt-6">
                <CardTitle className="text-2xl text-center">Create Company</CardTitle>
                <CardDescription className="text-center">
                  Provision a new dedicated tenant workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        id="companyName" 
                        placeholder="Acme Corp" 
                        className="pl-9"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-md border text-sm text-muted-foreground flex items-start gap-2">
                    <Globe className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground mb-0.5">Your dedicated URL will be:</p>
                      <p className="font-mono text-xs break-all">{subdomain}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="adminName">Admin Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        id="adminName" 
                        placeholder="John Doe" 
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        id="adminEmail" 
                        type="email" 
                        placeholder="admin@company.com" 
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        id="adminPassword" 
                        type="password" 
                        className="pl-9"
                        required
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  
                  {registerError && (
                    <p className="text-sm text-destructive" role="alert">{registerError}</p>
                  )}

                  <Button type="submit" className="w-full mt-2">
                    Create Workspace
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
          
          <CardFooter className="flex flex-col items-center text-center justify-center border-t border-border/50 bg-muted/20 py-4 mt-2 rounded-b-lg">
            <ShieldCheck className="size-4 text-green-500 mb-2" />
            <p className="text-xs text-muted-foreground">
              Single-tenant architecture. Your data is isolated and encrypted.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
