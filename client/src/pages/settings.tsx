import { useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Shield, Loader2, Bell } from "lucide-react";
import { NotificationSettings } from "@/components/NotificationSettings";
import { useCurrentUser, PRIVILEGED_ROLES } from "@/hooks/use-auth";
import DataImport from "@/components/DataImport";

export default function Settings({ 
  defaultLandingPage, 
  setDefaultLandingPage 
}: { 
  defaultLandingPage: string; 
  setDefaultLandingPage: (page: string) => void;
}) {
  const { toast } = useToast();
  const { data: currentUser, isLoading: usersLoading } = useCurrentUser();
  const canImport = !!currentUser && PRIVILEGED_ROLES.includes(currentUser.role);

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your profile preferences have been updated.",
    });
  };

  // Arriving from the bell's settings button: jump to Notifications.
  useEffect(() => {
    if (window.location.hash === "#notifications") setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and defaults.</p>
        </div>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="size-5" /> Account Details</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <div className="p-2 border rounded-md bg-muted/50 text-sm">{currentUser?.name}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="p-2 border rounded-md bg-muted/50 text-sm">{currentUser?.email ?? "—"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 text-sm">
                      <Shield className="size-4 text-primary" /> {currentUser?.role}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>Customise how myCMMS works for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Landing Page</Label>
                <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/">Dashboard</SelectItem>
                    <SelectItem value="/jobs">Jobs List</SelectItem>
                    <SelectItem value="/assets">Assets</SelectItem>
                    <SelectItem value="/calendar">Calendar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This is the page you will be redirected to immediately after logging in.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="notifications" className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="size-5" /> Notifications</CardTitle>
              <CardDescription>New requests, jobs assigned to you, and the daily stock summary: in the app, and as alerts on your phone or computer.</CardDescription>
            </CardHeader>
            <CardContent><NotificationSettings /></CardContent>
          </Card>
          {canImport && <DataImport />}
        </div>
      </div>
    </Layout>
  );
}
