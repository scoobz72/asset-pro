import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-auth";
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
import RequestPortal from "@/pages/request-portal";
import Auth from "@/pages/auth";
import Settings from "@/pages/settings";
import StockTake from "@/pages/stock-take";
import Landing from "@/pages/landing";
import Companies from "@/pages/companies";
import { PLATFORM_ADMIN_ROLE } from "@/hooks/use-auth";

function Router({ defaultLandingPage, setDefaultLandingPage, isPlatformAdmin }: any) {
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
      <Route path="/request-portal" component={RequestPortal} />
      <Route path="/companies">{isPlatformAdmin ? <Companies /> : <NotFound />}</Route>
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

function AppContent() {
  const { data: currentUser, isLoading: authLoading } = useCurrentUser();
  const isAuthenticated = !!currentUser;
  const [defaultLandingPage, setDefaultLandingPage] = useState("/");
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    setLocation(defaultLandingPage);
  };

  return (
    <TooltipProvider>
        <Toaster />
        {authLoading ? (
          <div className="min-h-screen flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : !isAuthenticated ? (
          <Switch>
            <Route path="/login">
              <Auth onLogin={handleLogin} />
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
            <div className="bg-primary text-primary-foreground text-xs py-1.5 px-4 flex justify-between items-center z-50 relative">
              <span className="font-semibold" data-testid="text-company-name">{currentUser?.companyName}</span>
              {currentUser?.role === PLATFORM_ADMIN_ROLE && (
                <span className="opacity-80">Platform admin</span>
              )}
            </div>
            <Router 
              defaultLandingPage={defaultLandingPage}
              setDefaultLandingPage={setDefaultLandingPage}
              isPlatformAdmin={currentUser?.role === PLATFORM_ADMIN_ROLE}
            />
          </>
        )}
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
