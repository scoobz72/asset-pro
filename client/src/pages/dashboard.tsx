import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Package,
  Wrench,
  Timer,
  AlertOctagon,
  Mail,
  Send,
} from "lucide-react";
import { useAssets, useInventory, useDashboardSummary } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type DashboardSummary = {
  openJobs: number;
  openedThisWeek: number;
  openedLastWeek: number;
  completedThisWeek: number;
  completedLastWeek: number;
  assetsDown: number;
  assetsTotal: number;
  lowStock: number;
  daily: { day: string; opened: number; completed: number }[];
  mtbfDays: number | null;
  mttrHours: number | null;
};

type Stat = {
  title: string;
  value: string | number;
  icon: typeof Clock;
  color: string;
  link: string;
  /** Plain-English note under the figure. */
  note: string;
  /** Change vs the previous 7 days, when there is a real comparison. */
  delta?: number;
  /** Whether a rise is good news (green) or bad news (amber). */
  riseIsGood?: boolean;
};

function Trend({ delta, riseIsGood }: { delta: number; riseIsGood: boolean }) {
  if (delta === 0) return <Minus className="mr-1 size-3 text-muted-foreground" />;
  const good = delta > 0 === riseIsGood;
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return <Icon className={cn("mr-1 size-3", good ? "text-green-600" : "text-amber-600")} />;
}

export default function Dashboard() {
  const [isEmailing, setIsEmailing] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: summaryData, isLoading: summaryLoading } = useDashboardSummary();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: inventoryItems = [], isLoading: inventoryLoading } = useInventory();
  const summary = summaryData as DashboardSummary | undefined;

  const lowStockItems = useMemo(() => {
    return (inventoryItems as any[]).filter((i: any) => i.stock < i.minStock);
  }, [inventoryItems]);

  const criticalAssets = useMemo(() => {
    return (assets as any[]).filter((a: any) => a.status === "Down" || a.status === "Maintenance");
  }, [assets]);

  const chartData = useMemo(
    () => (summary?.daily ?? []).map((d) => ({ name: format(parseISO(d.day), "EEE dd MMM"), opened: d.opened, completed: d.completed })),
    [summary],
  );

  const handleScheduleEmail = (e: React.FormEvent) => {
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

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const stats: Stat[] = summary ? [
    {
      title: "Open Jobs",
      value: summary.openJobs,
      icon: Clock,
      color: "text-blue-500",
      link: "/jobs",
      delta: summary.openedThisWeek - summary.openedLastWeek,
      riseIsGood: false,
      note: `${summary.openedThisWeek} opened this week (${signed(summary.openedThisWeek - summary.openedLastWeek)} vs last)`,
    },
    {
      title: "Completed (7 days)",
      value: summary.completedThisWeek,
      icon: CheckCircle2,
      color: "text-green-500",
      link: "/jobs",
      delta: summary.completedThisWeek - summary.completedLastWeek,
      riseIsGood: true,
      note: `${signed(summary.completedThisWeek - summary.completedLastWeek)} vs previous 7 days`,
    },
    {
      title: "Assets Down",
      value: summary.assetsDown,
      icon: AlertTriangle,
      color: "text-destructive",
      link: "/assets",
      note: `Down or in maintenance, of ${summary.assetsTotal} assets`,
    },
    {
      title: "Low Stock Items",
      value: summary.lowStock,
      icon: Package,
      color: "text-orange-500",
      link: "/inventory",
      note: "Below minimum stock",
    },
    {
      title: "MTBF",
      value: summary.mtbfDays == null ? "Not enough data" : `${summary.mtbfDays} days`,
      icon: Wrench,
      color: "text-indigo-500",
      link: "/reports",
      note: summary.mtbfDays == null ? "Needs 2+ breakdowns on an asset" : "Median time between breakdowns",
    },
    {
      title: "MTTR",
      value: summary.mttrHours == null ? "Not enough data" : `${summary.mttrHours} h`,
      icon: Timer,
      color: "text-teal-500",
      link: "/reports",
      note: summary.mttrHours == null ? "No breakdowns completed in 90 days" : "Mean time to repair, last 90 days",
    },
  ] : [];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of maintenance operations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6 mb-6">
        {summaryLoading || !summary ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow-sm h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="size-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat) => (
            <Link key={stat.title} href={stat.link}>
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium hover:text-primary transition-colors">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={cn("size-4", stat.color)} />
                </CardHeader>
                <CardContent>
                  <div className={cn("font-bold", typeof stat.value === "string" && stat.value.startsWith("Not") ? "text-base text-muted-foreground" : "text-2xl")}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    {stat.delta !== undefined && <Trend delta={stat.delta} riseIsGood={!!stat.riseIsGood} />}
                    <span>{stat.note}</span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-6">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Jobs Opened vs Completed</CardTitle>
            <CardDescription>Last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {summaryLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="opened" name="Opened" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <AlertOctagon className="size-4 mr-2 text-destructive" />
                Critical Asset Alerts
              </CardTitle>
              <Link href="/assets">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="pb-4">
              {assetsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded" />
                        <div>
                          <Skeleton className="h-4 w-28 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : criticalAssets.length > 0 ? (
                <div className="space-y-4">
                  {criticalAssets.map((asset: any) => (
                    <div key={asset.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xs">
                          {asset.name.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{asset.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{asset.locationId || "Unknown"}</p>
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
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Package className="size-4 mr-2 text-orange-500" />
                Low Stock Alerts
              </CardTitle>
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="pb-4">
              {inventoryLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded" />
                        <div>
                          <Skeleton className="h-4 w-28 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-12 mb-1" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : lowStockItems.length > 0 ? (
                <div className="space-y-4">
                  {lowStockItems.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center">
                          <Package className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.id}</p>
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
