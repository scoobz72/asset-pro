import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogoFull } from "@/components/Logo";
import { ShieldCheck, Factory, CheckCircle2, ArrowRight, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const features = [
  "Jobs, planned maintenance and templates",
  "Assets, locations and audits",
  "Inventory, suppliers and purchase orders",
  "Role-based access for your team",
];

function RequestAccessForm() {
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await apiRequest("POST", "/api/access-requests", form);
      setState("sent");
    } catch (err) {
      const msg = err instanceof Error && err.message.startsWith("429")
        ? "Too many requests from your connection. Please try again later."
        : "Something went wrong. Please check the form and try again.";
      setError(msg);
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="text-center py-8" data-testid="text-request-sent">
        <CheckCircle2 className="size-10 text-green-500 mx-auto mb-3" />
        <h3 className="text-xl font-semibold mb-1">Thanks, we've got your request</h3>
        <p className="text-muted-foreground">We'll be in touch to set up your company's account.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ra-name">Your name</Label>
          <Input id="ra-name" required maxLength={200} value={form.name} onChange={set("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-company">Company</Label>
          <Input id="ra-company" required maxLength={200} value={form.company} onChange={set("company")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-email">Email</Label>
          <Input id="ra-email" type="email" required maxLength={320} value={form.email} onChange={set("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-phone">Phone (optional)</Label>
          <Input id="ra-phone" type="tel" maxLength={50} value={form.phone} onChange={set("phone")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ra-message">What would you like to manage? (optional)</Label>
        <Textarea id="ra-message" rows={4} maxLength={2000} value={form.message} onChange={set("message")} />
      </div>
      {/* Honeypot for bots: hidden from people and screen readers */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="ra-website">Website</label>
        <input id="ra-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" className="w-full gap-2" disabled={state === "sending"} data-testid="button-request-access">
        <Send className="size-4" /> {state === "sending" ? "Sending..." : "Request access"}
      </Button>
    </form>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-6 lg:px-14 h-20 flex items-center justify-between border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <a href="/" className="flex items-center" aria-label="myCMMS home">
          <LogoFull className="text-2xl md:text-3xl" />
        </a>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#request-access" className="hover:text-foreground transition-colors">Request access</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button className="font-medium">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 lg:py-32 px-6 lg:px-14 relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom" />
          <div className="absolute left-0 right-0 top-1/4 -z-10 m-auto h-[400px] w-[600px] rounded-full bg-primary/20 opacity-30 blur-[120px]" />

          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold mb-6 bg-primary/10 text-primary border border-primary/20">
            CMMS for maintenance teams
          </span>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-6">
            Industrial Maintenance, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Perfectly Engineered.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Manage jobs, assets, inventory and suppliers in one place. Every company gets its own
            secure workspace, and your team signs in at one address.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
            <a href="#request-access" className="w-full">
              <Button size="lg" className="w-full h-14 text-base gap-2">
                Request access <ArrowRight className="size-4" />
              </Button>
            </a>
            <Link href="/login" className="w-full">
              <Button size="lg" variant="outline" className="w-full h-14 text-base bg-background">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="py-16 px-6 lg:px-14 bg-muted/30 border-y">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="size-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-6">
                <ShieldCheck className="size-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Your company's own workspace</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Your assets, jobs, stock and people are kept completely separate from every other
                company. Your managers control who has access and what they can do.
              </p>
              <ul className="space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 font-medium">
                    <CheckCircle2 className="size-5 text-green-500" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-primary/10 rounded-2xl blur-2xl" />
              <Card className="relative bg-background/80 backdrop-blur border-border/50 shadow-2xl overflow-hidden">
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                  <Factory className="size-16 text-primary mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Built for the shop floor</h3>
                  <p className="text-muted-foreground">Breakdowns, planned maintenance, stock takes and audits, all in one system.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="request-access" className="py-16 px-6 lg:px-14 scroll-mt-20">
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Request access</CardTitle>
                <CardDescription>Tell us about your company and we'll set up your workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <RequestAccessForm />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="py-10 px-6 lg:px-14 border-t text-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3">
          <LogoFull className="text-xl" />
          <p className="tracking-[0.3em] text-xs font-semibold uppercase">Maintenance · Assets · PPM</p>
          <p>© {new Date().getFullYear()} myCMMS.co.uk</p>
        </div>
      </footer>
    </div>
  );
}
