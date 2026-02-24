import { Button } from "@/components/ui/button";
import { Wrench, ShieldCheck, Zap, Factory, CheckCircle2, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-6 lg:px-14 h-20 flex items-center justify-between border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
             <Wrench className="size-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">ProMaintain</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-medium">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="font-medium gap-2">
              <Building2 className="size-4" /> Register Company
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 lg:py-32 px-6 lg:px-14 relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom" />
          <div className="absolute left-0 right-0 top-1/4 -z-10 m-auto h-[400px] w-[600px] rounded-full bg-primary/20 opacity-30 blur-[120px]" />
          
          <Badge className="mb-6 px-3 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            Next-Gen CMMS Platform
          </Badge>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-6">
            Industrial Maintenance, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Perfectly Engineered.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            The multi-tenant CMMS that gives your company its own dedicated, secure subdomain. Manage assets, inventory, and operations with precision.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
            <Link href="/register" className="w-full">
              <Button size="lg" className="w-full h-14 text-base gap-2">
                <Building2 className="size-5" /> Start Free Trial
              </Button>
            </Link>
            <Link href="/login" className="w-full">
              <Button size="lg" variant="outline" className="w-full h-14 text-base gap-2 bg-background">
                View Demo App <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Multi-tenant feature highlight */}
        <section className="py-16 px-6 lg:px-14 bg-muted/30 border-y">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="size-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-6">
                <ShieldCheck className="size-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Dedicated Subdomains for Every Company</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                When you register, you instantly get your own isolated instance (e.g., <strong>yourcompany.promaintain.app</strong>).
                Your data, assets, and users are completely separated in a secure, single-tenant architecture.
              </p>
              <ul className="space-y-3">
                {[
                  "Isolated database environments",
                  "Custom company branding",
                  "Dedicated SSO configuration",
                  "Role-based access control"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium">
                    <CheckCircle2 className="size-5 text-green-500" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-primary/10 rounded-2xl blur-2xl" />
              <Card className="relative bg-background/80 backdrop-blur border-border/50 shadow-2xl overflow-hidden">
                <div className="h-10 border-b flex items-center px-4 gap-2 bg-muted/50">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-500/80" />
                    <div className="size-3 rounded-full bg-yellow-500/80" />
                    <div className="size-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="mx-auto bg-background px-24 py-1 text-xs rounded-md border text-muted-foreground font-mono flex items-center gap-2">
                    <ShieldCheck className="size-3 text-green-500" />
                    https://acmecorp.promaintain.app
                  </div>
                </div>
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                  <Factory className="size-16 text-primary mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Acme Corp CMMS</h3>
                  <p className="text-muted-foreground">Secure single-tenant environment initialized.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 px-6 lg:px-14 border-t text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} ProMaintain Systems. Mockup Demo.</p>
      </footer>
    </div>
  );
}

// Dummy badge component for the landing page
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${className}`}>
      {children}
    </span>
  );
}