import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  Activity,
  Calendar as CalendarIcon,
  Wrench,
  AlertOctagon,
  Mail,
  Send,
  MessageSquare,
  Sparkles,
  Bot
} from "lucide-react";
import { jobs, assets, inventory } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const chartData = [
  { name: 'Mon', completed: 4, opened: 6 },
  { name: 'Tue', completed: 3, opened: 2 },
  { name: 'Wed', completed: 7, opened: 5 },
  { name: 'Thu', completed: 5, opened: 4 },
  { name: 'Fri', completed: 8, opened: 3 },
  { name: 'Sat', completed: 2, opened: 1 },
  { name: 'Sun', completed: 1, opened: 0 },
];

export default function Dashboard() {
  const [dateFilter, setDateFilter] = useState("7days");
  const [isEmailing, setIsEmailing] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const { toast } = useToast();

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    
    setIsAsking(true);
    setAiResponse(null);
    
    // Simulate AI thinking and response
    setTimeout(() => {
      setIsAsking(false);
      
      const query = aiQuery.toLowerCase();
      if (query.includes("low stock") || query.includes("parts")) {
        setAiResponse(`I found ${inventory.filter(i => i.stock < i.minStock).length} parts currently below their minimum stock levels. The most critical is the 'Hydraulic Fluid' which has a 5-day lead time. Would you like me to draft a purchase order for these?`);
      } else if (query.includes("asset") || query.includes("breakdown") || query.includes("broken")) {
        setAiResponse(`In the last week, the 'Generator Backup' (A-205) has had the most downtime. It is currently marked as 'Down' and has 2 open jobs related to it. I recommend reviewing its recent maintenance history.`);
      } else {
        setAiResponse(`Based on our current data, overall completion rate is steady at 94%. We have 4 open jobs, and 1 critical asset currently down. Is there a specific area you'd like me to analyze further?`);
      }
    }, 1500);
  };
    e.preventDefault();
    setIsEmailing(true);
    setTimeout(() => {
      setIsEmailing(false);
      setIsEmailDialogOpen(false);
      toast({
        title: "Report Scheduled",
        description: "Dashboard report has been scheduled successfully.",
      });
    }, 1000);
  };

  const stats = [
    { 
      title: "Open Jobs", 
      value: jobs.filter(j => j.status !== "Completed").length, 
      change: "+2.5%", 
      trend: "up",
      icon: Clock,
      color: "text-blue-500"
    },
    { 
      title: "MTBF", 
      value: "412 hrs", 
      change: "+15 hrs", 
      trend: "up",
      icon: Wrench,
      color: "text-indigo-500"
    },
    { 
      title: "Critical Assets Down", 
      value: assets.filter(a => a.status === "Down").length, 
      change: "-1", 
      trend: "down",
      icon: AlertTriangle,
      color: "text-destructive"
    },
    { 
      title: "Low Stock Items", 
      value: inventory.filter(i => i.stock < i.minStock).length, 
      change: "+2", 
      trend: "up",
      icon: Package,
      color: "text-orange-500"
    },
    { 
      title: "Completion Rate", 
      value: "94%", 
      change: "+1.2%", 
      trend: "up",
      icon: CheckCircle2,
      color: "text-green-500"
    },
  ];

  const criticalAssets = assets.filter(a => a.status === "Down" || a.status === "Maintenance");
  const lowStockItems = inventory.filter(i => i.stock < i.minStock);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of maintenance operations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1 mr-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px] border-0 h-8 focus:ring-0 px-1 shadow-none bg-transparent">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Mail className="size-4" />
                Schedule Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Schedule Dashboard Report</DialogTitle>
                <DialogDescription>
                  Set up automated email delivery for this dashboard view.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleScheduleEmail} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="recipients">Recipients (comma separated)</Label>
                  <Input id="recipients" placeholder="team@company.com, manager@company.com" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select defaultValue="weekly">
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (8:00 AM)</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday 8:00 AM)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st of Month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Include Sections</Label>
                  <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="inc-kpi" defaultChecked />
                      <label htmlFor="inc-kpi" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Key Performance Indicators</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="inc-charts" defaultChecked />
                      <label htmlFor="inc-charts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Trend Charts</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="inc-alerts" defaultChecked />
                      <label htmlFor="inc-alerts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Critical Alerts & Low Stock</label>
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isEmailing}>
                    {isEmailing ? "Saving..." : (
                      <>
                        <Send className="mr-2 size-4" />
                        Schedule
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline">Download PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn("size-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="mr-1 size-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 size-3 text-red-500" />
                )}
                <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                  {stat.change}
                </span>
                <span className="ml-1">vs prev period</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-6">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Job Completion Trend</CardTitle>
            <CardDescription>Maintenance tasks over {dateFilter === "7days" ? "the last 7 days" : "the selected period"}.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value}`} 
                />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="opened" name="Opened" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <div className="col-span-3 space-y-4">
          <Card className="shadow-sm border-primary/20 bg-primary/5">
            <CardHeader className="py-4 pb-2">
              <CardTitle className="text-base flex items-center text-primary">
                <Bot className="size-5 mr-2" />
                Ask SmartAIss
              </CardTitle>
              <CardDescription className="text-xs">
                Ask questions about your assets, inventory, or operations.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setAiQuery("Show me parts with low stock")}>Low stock parts?</Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setAiQuery("Which assets broke down most this week?")}>Frequent breakdowns?</Badge>
              </div>
              
              <form onSubmit={handleAskAI} className="flex gap-2">
                <Input 
                  placeholder="Ask a question..." 
                  className="h-9 bg-background" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                />
                <Button type="submit" size="sm" className="h-9 px-3" disabled={isAsking || !aiQuery.trim()}>
                  {isAsking ? <Activity className="size-4 animate-pulse" /> : <Sparkles className="size-4" />}
                </Button>
              </form>

              {aiResponse && (
                <div className="mt-3 p-3 bg-background rounded-md text-sm border shadow-sm animate-in fade-in slide-in-from-bottom-2 flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 text-primary rounded-full shrink-0 mt-0.5">
                    <Sparkles className="size-3" />
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {aiResponse}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center">
                <AlertOctagon className="size-4 mr-2 text-destructive" />
                Critical Asset Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {criticalAssets.length > 0 ? (
                <div className="space-y-4">
                  {criticalAssets.map(asset => (
                    <div key={asset.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xs">
                          {asset.name.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{asset.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{asset.location}</p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-red-500">{asset.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center justify-center py-4">
                  <CheckCircle2 className="size-4 mr-2 text-green-500" />
                  All critical assets are operational.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center">
                <Package className="size-4 mr-2 text-orange-500" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {lowStockItems.length > 0 ? (
                <div className="space-y-4">
                  {lowStockItems.slice(0, 4).map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center">
                          <Package className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-600">{item.stock} {item.unit}</p>
                        <p className="text-[10px] text-muted-foreground">Min: {item.minStock}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center justify-center py-4">
                  <CheckCircle2 className="size-4 mr-2 text-green-500" />
                  Inventory levels are optimal.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

