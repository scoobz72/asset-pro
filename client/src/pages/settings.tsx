import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Shield, Upload, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useUsers } from "@/hooks/use-data";

export default function Settings({ 
  defaultLandingPage, 
  setDefaultLandingPage 
}: { 
  defaultLandingPage: string; 
  setDefaultLandingPage: (page: string) => void;
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const currentUser = (users as any[])[0];

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your profile preferences have been updated.",
    });
  };

  const handleImport = (type: string) => {
    setIsUploading(type);
    setTimeout(() => {
      setIsUploading(null);
      toast({
        title: "Import Successful",
        description: `Successfully imported ${type} data from Excel template.`,
      });
    }, 2000);
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
                    <div className="p-2 border rounded-md bg-muted/50 text-sm">{currentUser?.name || "John Doe"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="p-2 border rounded-md bg-muted/50 text-sm">{currentUser?.email || "john.doe@company.com"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 text-sm">
                      <Shield className="size-4 text-primary" /> {currentUser?.role || "System Admin"}
                    </div>
                  </div>
                </>
              )}
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

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Upload className="size-5" /> Data Import (Admin Only)
              </CardTitle>
              <CardDescription>
                Import your existing data to quickly set up your workspace. Download the Excel templates, fill them out, and upload them below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "Assets & Equipment", type: "assets" },
                { name: "Inventory & Stock", type: "inventory" },
                { name: "Supplier Directory", type: "suppliers" },
                { name: "User Accounts", type: "users" },
              ].map((item) => (
                <div key={item.type} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-md bg-background gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="p-2 bg-muted rounded">
                      <FileSpreadsheet className="size-4 text-green-600" />
                    </div>
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto gap-2" title="Download Template">
                      <Download className="size-4" /> <span className="sr-only sm:not-sr-only">Template</span>
                    </Button>
                    <Button 
                      size="sm" 
                      className="w-full sm:w-auto gap-2"
                      onClick={() => handleImport(item.type)}
                      disabled={isUploading === item.type}
                    >
                      <Upload className="size-4" /> 
                      {isUploading === item.type ? "Importing..." : "Upload"}
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="bg-background border rounded-md p-4 mt-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Import Guidelines:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Please use the provided .xlsx templates without modifying the column headers.</li>
                  <li>Maximum file size is 10MB per upload.</li>
                  <li>Duplicate records will be skipped during import.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
