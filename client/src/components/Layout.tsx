import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Box, 
  Wrench, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Settings,
  Menu,
  Bell,
  Search,
  ChevronDown,
  FileSignature,
  ArrowRightLeft,
  ShoppingCart,
  Truck,
  ScanLine,
  MapPin,
  ClipboardEdit,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { LogoIcon } from "@/components/Logo";
import { useCurrentUser, useLogout, PLATFORM_ADMIN_ROLE } from "@/hooks/use-auth";

const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Request Portal', href: '/request-portal', icon: ClipboardEdit },
  { name: 'Jobs', href: '/jobs', icon: ClipboardList },
  { name: 'Templates', href: '/templates', icon: FileSignature },
  { name: 'Assets', href: '/assets', icon: Box },
  { name: 'Asset Audits', href: '/audits', icon: ScanLine },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Inventory', href: '/inventory', icon: Wrench },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
  { name: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
  { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();
  const navigation = currentUser?.role === PLATFORM_ADMIN_ROLE
    ? [{ name: 'Companies', href: '/companies', icon: Building2 }, ...baseNavigation]
    : baseNavigation;
  const initials = (currentUser?.name || "").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 flex items-center gap-3">
          <LogoIcon className="size-8" />
          <span className="text-lg tracking-tight"><span className="font-normal">my</span><span className="font-extrabold">CMMS</span></span>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  <item.icon className="size-4" />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/settings">
            <a className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}>
              <Settings className="size-4" />
              Settings
            </a>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
                 <div className="p-6 flex items-center gap-3">
                  <LogoIcon className="size-8" />
                  <span className="text-lg tracking-tight"><span className="font-normal">my</span><span className="font-extrabold">CMMS</span></span>
                </div>
                <nav className="px-4 py-4 space-y-1">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href}>
                      <a 
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                          location === item.href
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className="size-4" />
                        {item.name}
                      </a>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            
            <div className="hidden md:flex relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search jobs, assets..." 
                className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1" 
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 size-2 bg-destructive rounded-full border-2 border-card" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="pl-0 gap-2 hover:bg-transparent">
                  <Avatar className="size-8 border">
                    <AvatarImage src={currentUser?.avatar ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start text-xs">
                    <span className="font-semibold">{currentUser?.name}</span>
                    <span className="text-muted-foreground">{currentUser?.role}</span>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/settings")}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => logout.mutate(undefined, { onSettled: () => setLocation("/") })}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
