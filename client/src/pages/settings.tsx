import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Shield } from "lucide-react";

export default function Settings({ 
  defaultLandingPage, 
  setDefaultLandingPage 
}: { 
  defaultLandingPage: string; 
  setDefaultLandingPage: (page: string) => void;
}) {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your profile preferences have been updated.",
    });
  };

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="size-5" /> Account Details</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <div className="p-2 border rounded-md bg-muted/50 text-sm">John Doe</div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 border rounded-md bg-muted/50 text-sm">john.doe@company.com</div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 text-sm">
                <Shield className="size-4 text-primary" /> System Admin
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application Preferences</CardTitle>
            <CardDescription>Customize how ProMaintain works for you.</CardDescription>
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
    </Layout>
  );
}
