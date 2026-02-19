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
  Activity
} from "lucide-react";
import { jobs, assets, inventory } from "@/lib/mockData";
import { cn } from "@/lib/utils";

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
  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of maintenance operations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Download Report</Button>
          <Button>Create Job</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <span className="ml-1">from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Job Completion Trend</CardTitle>
            <CardDescription>Weekly overview of maintenance tasks.</CardDescription>
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
        
        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from the team.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center">
                  <div className={cn(
                    "size-9 rounded-full flex items-center justify-center border",
                    job.priority === "Critical" ? "bg-red-100 text-red-600 border-red-200" :
                    job.priority === "High" ? "bg-orange-100 text-orange-600 border-orange-200" :
                    "bg-blue-100 text-blue-600 border-blue-200"
                  )}>
                    <Activity className="size-4" />
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.id} • {job.status}
                    </p>
                  </div>
                  <div className="ml-auto font-medium">
                    <Badge variant={job.status === "Completed" ? "default" : "outline"}>
                      {job.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
