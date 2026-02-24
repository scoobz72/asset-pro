import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import Templates from "@/pages/templates";
import Assets from "@/pages/assets";
import Audits from "@/pages/audits";
import Inventory from "@/pages/inventory";
import Suppliers from "@/pages/suppliers";
import Transactions from "@/pages/transactions";
import PurchaseOrders from "@/pages/purchase-orders";
import Calendar from "@/pages/calendar";
import Team from "@/pages/team";
import Reports from "@/pages/reports";
import Locations from "@/pages/locations";
import Auth from "@/pages/auth";
import Settings from "@/pages/settings";
import StockTake from "@/pages/stock-take";
import Landing from "@/pages/landing";

function Router({ defaultLandingPage, setDefaultLandingPage }: any) {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/templates" component={Templates} />
      <Route path="/assets" component={Assets} />
      <Route path="/audits" component={Audits} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/stock-take" component={StockTake} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/team" component={Team} />
      <Route path="/reports" component={Reports} />
      <Route path="/locations" component={Locations} />
      <Route path="/settings">
        <Settings 
          defaultLandingPage={defaultLandingPage} 
          setDefaultLandingPage={setDefaultLandingPage} 
        />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<string | null>(null);
  const [defaultLandingPage, setDefaultLandingPage] = useState("/");
  const [location, setLocation] = useLocation();

  const handleLogin = (companyName?: string) => {
    setIsAuthenticated(true);
    if (companyName) setCurrentCompany(companyName);
    setLocation(defaultLandingPage);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {!isAuthenticated ? (
          <Switch>
            <Route path="/login">
              <Auth onLogin={handleLogin} defaultTab="login" />
            </Route>
            <Route path="/register">
              <Auth onLogin={handleLogin} defaultTab="register" />
            </Route>
            <Route path="/">
              <Landing />
            </Route>
            <Route>
              <Landing />
            </Route>
          </Switch>
        ) : (
          <>
            {/* Mock Subdomain Banner */}
            <div className="bg-primary text-primary-foreground text-xs py-1.5 px-4 flex justify-between items-center z-50 relative">
              <div className="flex items-center gap-2 font-mono">
                <span className="opacity-70">Secured Tenant Domain:</span>
                <span className="font-semibold">
                  {currentCompany 
                    ? `https://${currentCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.promaintain.app` 
                    : "https://demo.promaintain.app"}
                </span>
              </div>
              <div className="hidden sm:block opacity-80">
                {currentCompany ? `${currentCompany} Workspace` : "Demo Workspace"}
              </div>
            </div>
            <Router 
              defaultLandingPage={defaultLandingPage}
              setDefaultLandingPage={setDefaultLandingPage}
            />
          </>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
