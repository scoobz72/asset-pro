import Layout from "@/components/Layout";
import { assets } from "@/lib/mockData";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  MapPin, 
  Activity, 
  Calendar 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Assets() {
  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-1">Monitor equipment health and location.</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Plus className="mr-2 size-4" />
            Add Asset
          </Button>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <Card key={asset.id} className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg font-semibold">{asset.name}</CardTitle>
                <CardDescription className="font-mono text-xs mt-1">{asset.id}</CardDescription>
              </div>
              <Badge variant={asset.status === "Operational" ? "default" : "destructive"} className={cn(
                asset.status === "Operational" ? "bg-green-500 hover:bg-green-600" : 
                asset.status === "Maintenance" ? "bg-yellow-500 hover:bg-yellow-600" :
                "bg-red-500 hover:bg-red-600"
              )}>
                {asset.status}
              </Badge>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid gap-4 mt-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="mr-2 size-4 opacity-70" />
                  {asset.location}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-muted-foreground">
                      <Activity className="mr-2 size-4 opacity-70" /> Health
                    </span>
                    <span className={cn(
                      "font-medium",
                      asset.health > 90 ? "text-green-600" :
                      asset.health > 70 ? "text-yellow-600" :
                      "text-red-600"
                    )}>{asset.health}%</span>
                  </div>
                  <Progress value={asset.health} className={cn(
                    "h-2",
                    "[&>div]:bg-green-500",
                    asset.health < 90 && "[&>div]:bg-yellow-500",
                    asset.health < 70 && "[&>div]:bg-red-500"
                  )} />
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 size-4 opacity-70" />
                  Last Service: {asset.lastService}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-4 flex justify-between items-center border-t">
              <Button variant="ghost" size="sm">History</Button>
              <Button variant="outline" size="sm">View Details</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
