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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Check,
  FolderTree,
  List,
  Building2,
  Box,
  Upload,
  Map as MapIcon
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

import floorplanImg from "@/assets/images/floorplan.jpg";

export default function Assets() {
  const [assets, setAssets] = useState(initialAssets);
  const [uploadedDrawing, setUploadedDrawing] = useState<string | null>(null);
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

      <Tabs defaultValue="list" className="mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2"><List className="size-4" /> List View</TabsTrigger>
            <TabsTrigger value="topology" className="gap-2"><FolderTree className="size-4" /> Topology Map</TabsTrigger>
            <TabsTrigger value="drawing" className="gap-2"><MapIcon className="size-4" /> Floor Plan</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full sm:max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search assets..." className="pl-9" />
          </div>
        </div>

        <TabsContent value="list" className="space-y-4 m-0">
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
        </TabsContent>

        <TabsContent value="topology" className="m-0">
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle>Asset Topology Hierarchy</CardTitle>
              <CardDescription>
                Company overview organized by Site, Location, and Status.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-xl font-bold text-primary border-b pb-4">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Building2 className="size-6" />
                  </div>
                  ProMaintain Systems (Demo Workspace)
                </div>
                
                <div className="pl-8 space-y-10 border-l-2 ml-3 border-primary/20 py-2">
                  {sites.map(site => {
                    const siteLocs = locations.filter(l => l.siteId === site.id);
                    return (
                      <div key={site.id} className="relative">
                        <div className="absolute -left-[35px] top-3 w-8 h-0.5 bg-primary/20"></div>
                        <div className="flex items-center gap-2 font-bold text-lg mb-6 text-foreground/90">
                          <MapPin className="size-5 text-blue-500" />
                          {site.name}
                        </div>
                        
                        <div className="pl-8 space-y-8 border-l ml-2.5 border-border">
                          {siteLocs.map(loc => {
                            const locAssets = assets.filter(a => a.location === loc.name);
                            if (locAssets.length === 0) return null;
                            
                            const activeAssets = locAssets.filter(a => ["Operational", "Maintenance", "Down"].includes(a.status));
                            const inactiveAssets = locAssets.filter(a => ["Loaned Out", "In Storage"].includes(a.status));
                            
                            return (
                              <div key={loc.id} className="relative">
                                <div className="absolute -left-[33px] top-3 w-8 h-px bg-border"></div>
                                <div className="flex items-center gap-2 font-semibold mb-4 text-foreground/80">
                                  <Box className="size-4 text-muted-foreground" />
                                  {loc.name}
                                </div>
                                
                                <div className="pl-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {activeAssets.map(asset => (
                                    <div key={asset.id} className="p-4 border rounded-lg bg-card shadow-sm flex flex-col gap-3 relative group hover:border-primary/50 transition-all hover:shadow-md cursor-pointer">
                                      <div className="absolute -left-[25px] top-1/2 w-6 h-px bg-border group-hover:bg-primary/50 transition-colors"></div>
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold text-sm truncate">{asset.name}</span>
                                        <Badge variant={asset.status === "Operational" ? "default" : "destructive"} className={cn("text-[10px] h-5 px-1.5 shrink-0 whitespace-nowrap",
                                          asset.status === "Operational" ? "bg-green-500 hover:bg-green-600" : 
                                          asset.status === "Maintenance" ? "bg-yellow-500 hover:bg-yellow-600" :
                                          "bg-red-500 hover:bg-red-600"
                                        )}>
                                          {asset.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between mt-auto pt-1">
                                        <div className="text-xs text-muted-foreground font-mono">{asset.id}</div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                          <Activity className={cn("size-3", 
                                            asset.health > 90 ? "text-green-500" : asset.health > 70 ? "text-yellow-500" : "text-red-500"
                                          )} />
                                          {asset.health}%
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {inactiveAssets.map(asset => (
                                    <div key={asset.id} className="p-4 border border-dashed rounded-lg bg-muted/20 flex flex-col gap-3 relative group opacity-80 hover:opacity-100 transition-opacity">
                                      <div className="absolute -left-[25px] top-1/2 w-6 h-px bg-border border-dashed"></div>
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-medium text-sm text-muted-foreground truncate">{asset.name}</span>
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 shrink-0 whitespace-nowrap">
                                          {asset.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between mt-auto pt-1">
                                        <div className="text-xs text-muted-foreground/70 font-mono">{asset.id}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drawing" className="m-0">
          <Card className="shadow-sm border-primary/20 overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/10 flex flex-row items-start justify-between">
              <div>
                <CardTitle>Floor Plan & Drawings</CardTitle>
                <CardDescription>Upload CAD or PDF drawings to map assets visually.</CardDescription>
              </div>
              {uploadedDrawing && (
                <Button variant="outline" size="sm" onClick={() => setUploadedDrawing(null)}>
                  Remove Drawing
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!uploadedDrawing ? (
                <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-muted/5 min-h-[500px]">
                  <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Upload className="size-10 text-primary/70" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upload a Floor Plan</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Upload a PDF, blueprint, or CAD drawing to place interactive CMMS asset markers directly on top of your facility layout.
                  </p>
                  <Button onClick={() => setUploadedDrawing(floorplanImg)} className="gap-2">
                    <Upload className="size-4" /> Browse Files
                  </Button>
                </div>
              ) : (
                <div className="relative min-h-[600px] w-full bg-muted overflow-hidden group">
                  <img 
                    src={uploadedDrawing} 
                    alt="Floor Plan" 
                    className="w-full h-full object-cover opacity-60 mix-blend-multiply"
                  />
                  
                  {/* Simulated dropped pins */}
                  <div className="absolute top-[25%] left-[30%] -translate-x-1/2 -translate-y-1/2">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex flex-col items-center group cursor-pointer">
                          <div className="bg-green-500 text-white rounded-full p-2 shadow-lg mb-1 group-hover:scale-110 transition-transform ring-4 ring-green-500/20">
                            <Activity className="size-4" />
                          </div>
                          <Badge variant="secondary" className="shadow-sm font-bold border-green-500/30">CNC Machine X1</Badge>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold">CNC Machine X1</h4>
                          <Badge className="bg-green-500">Operational</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mb-3">
                          <p>ID: A-301</p>
                          <p>Health: 88%</p>
                        </div>
                        <Button size="sm" className="w-full h-8">View Details</Button>
                      </HoverCardContent>
                    </HoverCard>
                  </div>

                  <div className="absolute top-[45%] left-[65%] -translate-x-1/2 -translate-y-1/2">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex flex-col items-center group cursor-pointer">
                          <div className="bg-yellow-500 text-white rounded-full p-2 shadow-lg mb-1 group-hover:scale-110 transition-transform ring-4 ring-yellow-500/20 animate-pulse">
                            <Wrench className="size-4" />
                          </div>
                          <Badge variant="secondary" className="shadow-sm font-bold border-yellow-500/30">Conveyor Belt Main</Badge>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold">Conveyor Belt Main</h4>
                          <Badge className="bg-yellow-500">Maintenance</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mb-3">
                          <p>ID: A-102</p>
                          <p>Health: 45%</p>
                        </div>
                        <Button size="sm" className="w-full h-8">View Work Order</Button>
                      </HoverCardContent>
                    </HoverCard>
                  </div>

                  <div className="absolute top-[70%] left-[20%] -translate-x-1/2 -translate-y-1/2">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex flex-col items-center group cursor-pointer">
                          <div className="bg-red-500 text-white rounded-full p-2 shadow-lg mb-1 group-hover:scale-110 transition-transform ring-4 ring-red-500/20">
                            <Activity className="size-4" />
                          </div>
                          <Badge variant="secondary" className="shadow-sm font-bold border-red-500/30">Generator Backup</Badge>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold">Generator Backup</h4>
                          <Badge className="bg-red-500">Down</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mb-3">
                          <p>ID: A-205</p>
                          <p>Health: 0%</p>
                        </div>
                        <Button size="sm" variant="destructive" className="w-full h-8">Report Issue</Button>
                      </HoverCardContent>
                    </HoverCard>
                  </div>

                  {/* Floating Action Bar */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur shadow-xl border rounded-full px-4 py-2 flex gap-2 items-center">
                    <Button variant="ghost" size="sm" className="rounded-full h-8">
                      <MapPin className="size-4 mr-2" /> Place Asset
                    </Button>
                    <div className="w-px h-4 bg-border"></div>
                    <Button variant="ghost" size="sm" className="rounded-full h-8">
                      <Upload className="size-4 mr-2" /> Update Plan
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
