import Layout from "@/components/Layout";
import { assets as initialAssets, inventory, locations, sites } from "@/lib/mockData";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
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
  Calendar,
  Image as ImageIcon,
  Edit2,
  Wrench,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Assets() {
  const [assets, setAssets] = useState(initialAssets);
  const { toast } = useToast();

  const handleLocationChange = (assetId: string, newLocation: string) => {
    setAssets(assets.map(a => a.id === assetId ? { ...a, location: newLocation } : a));
    toast({
      title: "Location Updated",
      description: "The asset has been successfully relocated.",
    });
  };

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

      <div className="flex flex-col gap-4">
        {assets.map((asset) => (
          <Card key={asset.id} className="overflow-hidden transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row">
              {/* Asset Image / Placeholder */}
              <div className="sm:w-48 h-48 sm:h-auto bg-muted/50 flex flex-col items-center justify-center border-r relative group">
                <ImageIcon className="size-12 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground mt-2 font-medium">No Image</span>
                
                {/* Upload overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="secondary" size="sm" className="h-8">
                    <Plus className="mr-2 size-3" /> Upload
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl font-bold">{asset.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs font-normal">
                        {asset.id}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                       <MapPin className="size-4 opacity-70" />
                       <span className="font-medium text-foreground">{asset.location}</span>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button variant="ghost" size="sm" className="h-6 px-2 ml-1 text-xs">
                             Change
                           </Button>
                         </DialogTrigger>
                         <DialogContent className="sm:max-w-[425px]">
                           <DialogHeader>
                             <DialogTitle>Update Asset Location</DialogTitle>
                             <DialogDescription>
                               Move this asset to a new location.
                             </DialogDescription>
                           </DialogHeader>
                           <div className="grid gap-4 py-4">
                             <div className="space-y-2">
                               <Select onValueChange={(val) => handleLocationChange(asset.id, val)} defaultValue={asset.location}>
                                 <SelectTrigger>
                                   <SelectValue placeholder="Select new location" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {sites.map(site => {
                                     const siteLocs = locations.filter(l => l.siteId === site.id);
                                     if (siteLocs.length === 0) return null;
                                     return (
                                       <SelectGroup key={site.id}>
                                         <SelectLabel className="font-semibold text-primary/70">{site.name}</SelectLabel>
                                         {siteLocs.map(loc => (
                                           <SelectItem key={loc.id} value={loc.name}>
                                             <div className="flex items-center">
                                               {loc.name}
                                               {asset.location === loc.name && <Check className="ml-2 size-3 text-green-500" />}
                                             </div>
                                           </SelectItem>
                                         ))}
                                       </SelectGroup>
                                     );
                                   })}
                                 </SelectContent>
                               </Select>
                             </div>
                           </div>
                         </DialogContent>
                       </Dialog>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant={asset.status === "Operational" ? "default" : "destructive"} className={cn(
                      asset.status === "Operational" ? "bg-green-500 hover:bg-green-600" : 
                      asset.status === "Maintenance" ? "bg-yellow-500 hover:bg-yellow-600" :
                      "bg-red-500 hover:bg-red-600"
                    )}>
                      {asset.status}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Asset Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                           <Edit2 className="mr-2 size-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                           <MapPin className="mr-2 size-4" /> Move Location
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                           <ImageIcon className="mr-2 size-4" /> Update Photo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Schedule Maintenance</DropdownMenuItem>
                        <DropdownMenuItem>View History</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col justify-end pb-4 pt-2">
                  <div className="flex flex-wrap gap-4 items-end justify-between">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center text-muted-foreground">
                          <Activity className="mr-2 size-4 opacity-70" /> System Health
                        </span>
                        <span className={cn(
                          "font-bold",
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
                    
                    <div className="flex gap-4 text-right">
                      {asset.partsUsed && asset.partsUsed.length > 0 && (
                        <div className="space-y-1 text-left mr-4">
                          <p className="text-xs text-muted-foreground flex items-center">
                            <Wrench className="mr-1.5 size-3.5 opacity-70" /> Parts Used
                          </p>
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Button variant="link" className="h-auto p-0 text-sm font-medium">
                                {asset.partsUsed.length} Part(s)
                              </Button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold">Common Parts</h4>
                                <div className="text-sm">
                                  {asset.partsUsed.map(partId => {
                                    const part = inventory.find(p => p.id === partId);
                                    const isLow = part && part.stock < part.minStock;
                                    return (
                                      <div key={partId} className="flex justify-between items-center py-2 border-b last:border-0">
                                        <div>
                                          <div className="font-medium">{part?.name || partId}</div>
                                          <div className="text-xs text-muted-foreground">{partId}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className={cn("text-xs font-medium", isLow ? "text-red-500" : "text-green-600")}>
                                            {part ? `${part.stock} ${part.unit}` : 'Unknown'}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">In Stock</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center justify-end">
                          <Calendar className="mr-1.5 size-3.5 opacity-70" /> Last Service
                        </p>
                        <p className="text-sm font-medium">{asset.lastService}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
