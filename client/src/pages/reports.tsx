import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useJobs, useAssets, useInventory } from "@/hooks/use-data";
import { useMemo } from "react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Reports() {
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: inventory, isLoading: inventoryLoading } = useInventory();

  const jobList = (jobs as any[] || []);
  const assetList = (assets as any[] || []);
  const inventoryList = (inventory as any[] || []);

  const isLoading = jobsLoading || assetsLoading || inventoryLoading;

  const jobStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    jobList.forEach((job: any) => {
      const status = job.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [jobList]);

  const downtimeData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    assetList.forEach((asset: any) => {
      const status = asset.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, hours]) => ({ name, hours }));
  }, [assetList]);

  const spendingData = useMemo(() => {
    const categoryCounts: Record<string, { labor: number; parts: number }> = {};
    inventoryList.forEach((item: any) => {
      const cat = item.category || "Other";
      if (!categoryCounts[cat]) {
        categoryCounts[cat] = { labor: 0, parts: 0 };
      }
      categoryCounts[cat].parts += item.stock || 0;
      categoryCounts[cat].labor += item.minStock || 0;
    });
    return Object.entries(categoryCounts).map(([name, vals]) => ({ name, ...vals }));
  }, [inventoryList]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Maintenance analytics and insights.</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Distribution</CardTitle>
            <CardDescription>Breakdown by current status</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {jobStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {jobStatusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No job data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Status Overview</CardTitle>
            <CardDescription>Count by status</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {downtimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No asset data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>Stock vs. minimum stock levels</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {spendingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendingData}>
                  <defs>
                    <linearGradient id="colorLabor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorParts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="labor" name="Min Stock" stroke="#8884d8" fillOpacity={1} fill="url(#colorLabor)" />
                  <Area type="monotone" dataKey="parts" name="Current Stock" stroke="#82ca9d" fillOpacity={1} fill="url(#colorParts)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No inventory data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
