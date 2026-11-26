import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { useAssets, useLocations, useSites, useInventory, useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-data";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  LayoutGrid,
  Rows3,
  Building2,
  Box,
  Upload,
  Map as MapIcon,
  Trash2,
  Loader2
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ASSET_STATUSES, CRITICALITIES } from "@shared/constants";
import { useCurrentUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

import floorplanImg from "@/assets/images/floorplan.jpg";

type SpareLink = { assetId: string; partId: string; quantity: number };

/** Spares for every asset in one request (shared by every card and row). */
function useAllSpares() {
  return useQuery<SpareLink[]>({ queryKey: ["/api/asset-parts"], staleTime: 60000 });
}

function AssetPartsInfo({ assetId, links, inventoryData, compact = false }: {
  assetId: string; links: SpareLink[]; inventoryData: any[]; compact?: boolean;
}) {
  const parts = links.filter((l) => l.assetId === assetId);
  if (parts.length === 0) return compact ? <span className="text-muted-foreground">—</span> : null;

  return (
    <div className={cn("space-y-1 text-left", !compact && "mr-4")}>
      {!compact && (
        <p className="text-xs text-muted-foreground flex items-center">
          <Wrench className="mr-1.5 size-3.5 opacity-70" /> Spares
        </p>
      )}
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="link" className="h-auto p-0 text-sm font-medium" data-testid={`link-parts-${assetId}`}>
            {parts.length} part{parts.length === 1 ? "" : "s"}
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Spares</h4>
            <div className="text-sm">
              {parts.map((ap: any) => {
                const part = inventoryData?.find((p: any) => p.id === ap.partId);
                const isLow = part && part.stock < part.minStock;
                return (
                  <div key={ap.partId} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium">{part?.name || ap.partId}</div>
                      <div className="text-xs text-muted-foreground">{ap.partId}{ap.quantity > 1 ? ` · ${ap.quantity} fitted` : ""}</div>
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
  );
}

const OPTIONAL_ASSET_FIELDS = ["category", "manufacturer", "model", "serialNumber", "criticality", "installDate", "parentAssetId", "locationId"] as const;

/** Blank optional fields are sent as null, so the server never sees "" for a date or a link. */
function cleanAsset<T extends Record<string, any>>(asset: T): T {
  const out: Record<string, any> = { ...asset };
  for (const key of OPTIONAL_ASSET_FIELDS) {
    if (typeof out[key] === "string" && out[key].trim() === "") out[key] = null;
  }
  return out as T;
}

const NONE = "__none__";

/** Fields added for the real data model: make, model, criticality, parent asset. */
function AssetDetailFields({ value, onChange, assets, prefix }: {
  value: any;
  onChange: (next: any) => void;
  assets: any[];
  prefix: string;
}) {
  const set = (key: string, v: any) => onChange({ ...value, [key]: v });
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Input data-testid={`${prefix}-category`} placeholder="e.g. Conveyor" value={value.category ?? ""} onChange={(e) => set("category", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Criticality</Label>
          <Select value={value.criticality ?? NONE} onValueChange={(v) => set("criticality", v === NONE ? null : v)}>
            <SelectTrigger data-testid={`${prefix}-criticality`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Manufacturer</Label>
          <Input data-testid={`${prefix}-manufacturer`} value={value.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Input data-testid={`${prefix}-model`} value={value.model ?? ""} onChange={(e) => set("model", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Serial number</Label>
          <Input data-testid={`${prefix}-serial`} value={value.serialNumber ?? ""} onChange={(e) => set("serialNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Install date</Label>
          <Input data-testid={`${prefix}-install-date`} type="date" value={value.installDate ?? ""} onChange={(e) => set("installDate", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Parent asset</Label>
        <Select value={value.parentAssetId ?? NONE} onValueChange={(v) => set("parentAssetId", v === NONE ? null : v)}>
          <SelectTrigger data-testid={`${prefix}-parent`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {assets.filter((a) => a.id !== value.id).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name} ({a.id})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function AssetStatusBadge({ asset }: { asset: any }) {
  return (
    <Badge
      className={cn(
        "whitespace-nowrap",
        asset.status === "Operational" ? "bg-green-500 hover:bg-green-600" :
        asset.status === "Maintenance" ? "bg-yellow-500 hover:bg-yellow-600" :
        asset.status === "Down" ? "bg-red-500 hover:bg-red-600" :
        "bg-slate-500 hover:bg-slate-600",
      )}
      data-testid={`badge-asset-status-${asset.id}`}
    >
      {asset.status}
    </Badge>
  );
}

function HealthBar({ asset, compact = false }: { asset: any; compact?: boolean }) {
  const colour = asset.health > 90 ? "text-green-600" : asset.health > 70 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="space-y-1">
      {!compact && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center text-muted-foreground"><Activity className="mr-1.5 size-3.5 opacity-70" /> Health</span>
          <span className={cn("font-bold", colour)} data-testid={`text-asset-health-${asset.id}`}>{asset.health}%</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Progress value={asset.health} className={cn(
          "h-2 flex-1",
          "[&>div]:bg-green-500",
          asset.health < 90 && "[&>div]:bg-yellow-500",
          asset.health < 70 && "[&>div]:bg-red-500",
        )} />
        {compact && <span className={cn("text-xs font-semibold w-9 text-right", colour)}>{asset.health}%</span>}
      </div>
    </div>
  );
}

function AssetMenu({ asset, onEdit, onMove, onDelete }: { asset: any; onEdit: () => void; onMove: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/70 hover:bg-background" data-testid={`button-asset-menu-${asset.id}`} aria-label={`Actions for ${asset.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Asset Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid={`menu-edit-${asset.id}`} onClick={onEdit}>
          <Edit2 className="mr-2 size-4" /> Edit Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove}>
          <MapPin className="mr-2 size-4" /> Move Location
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid={`menu-delete-${asset.id}`} className="text-red-600" onClick={onDelete}>
          <Trash2 className="mr-2 size-4" /> Delete Asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Assets() {
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: locationsData = [] } = useLocations();
  const { data: sitesData = [] } = useSites();
  const { data: inventoryData = [] } = useInventory();
  
  const [uploadedDrawing, setUploadedDrawing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: spareLinks = [] } = useAllSpares();
  // Tiles or one row per asset; remembered in this browser.
  const [viewMode, setViewMode] = useState<"tiles" | "rows">(() => {
    try { return localStorage.getItem("assets.view") === "rows" ? "rows" : "tiles"; } catch { return "tiles"; }
  });
  const chooseView = (mode: "tiles" | "rows") => {
    setViewMode(mode);
    try { localStorage.setItem("assets.view", mode); } catch { /* storage unavailable */ }
  };
  const [movingAsset, setMovingAsset] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const emptyAsset = { id: "", name: "", locationId: "", status: "Operational", health: 100, category: "", manufacturer: "", model: "", serialNumber: "", criticality: null as string | null, installDate: "", parentAssetId: null as string | null };
  const [newAsset, setNewAsset] = useState(emptyAsset);
  const { data: currentUser } = useCurrentUser();
  const { toast } = useToast();

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "Unassigned";
    const loc = (locationsData as any[]).find((l: any) => l.id === locationId);
    return loc ? loc.name : locationId;
  };

  const createAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/assets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setAddDialogOpen(false);
      setNewAsset(emptyAsset);
      toast({ title: "Asset Created", description: "The new asset has been added successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/assets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setEditDialogOpen(false);
      setEditingAsset(null);
      toast({ title: "Asset Updated", description: "The asset has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset Deleted", description: "The asset has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLocationChange = (assetId: string, newLocationId: string) => {
    updateAssetMutation.mutate({ id: assetId, data: { locationId: newLocationId } });
  };

  const handleCreateAsset = () => {
    if (!newAsset.id || !newAsset.name) {
      toast({ title: "Validation Error", description: "ID and Name are required.", variant: "destructive" });
      return;
    }
    createAssetMutation.mutate(cleanAsset(newAsset));
  };

  const handleEditAsset = () => {
    if (!editingAsset) return;
    const { id, ...data } = cleanAsset(editingAsset);
    updateAssetMutation.mutate({ id, data });
  };

  const handleDeleteAsset = (id: string) => {
    deleteAssetMutation.mutate(id);
  };

  const filteredAssets = (assets as any[]).filter((asset: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const locName = getLocationName(asset.locationId).toLowerCase();
    return asset.name.toLowerCase().includes(q) || asset.id.toLowerCase().includes(q) || locName.includes(q);
  });

  if (assetsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Assets</h1>
          <p className="text-muted-foreground mt-1">Monitor equipment health and location.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-asset">
                <Plus className="mr-2 size-4" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
                <DialogDescription>Create a new asset in the system.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Asset ID</Label>
                  <Input data-testid="input-asset-id" placeholder="e.g. A-501" value={newAsset.id} onChange={(e) => setNewAsset({ ...newAsset, id: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input data-testid="input-asset-name" placeholder="Asset name" value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={newAsset.locationId} onValueChange={(val) => setNewAsset({ ...newAsset, locationId: val })}>
                    <SelectTrigger data-testid="select-asset-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sitesData as any[]).map((site: any) => {
                        const siteLocs = (locationsData as any[]).filter((l: any) => l.siteId === site.id);
                        if (siteLocs.length === 0) return null;
                        return (
                          <SelectGroup key={site.id}>
                            <SelectLabel className="font-semibold text-primary/70">{site.name}</SelectLabel>
                            {siteLocs.map((loc: any) => (
                              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newAsset.status} onValueChange={(val) => setNewAsset({ ...newAsset, status: val })}>
                    <SelectTrigger data-testid="select-asset-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Health (%)</Label>
                  <Input data-testid="input-asset-health" type="number" min={0} max={100} value={newAsset.health} onChange={(e) => setNewAsset({ ...newAsset, health: parseInt(e.target.value) || 0 })} />
                </div>
                <AssetDetailFields value={newAsset} onChange={setNewAsset} assets={assets as any[]} prefix="input-asset" />
              </div>
              <DialogFooter>
                <Button data-testid="button-submit-asset" onClick={handleCreateAsset} disabled={createAssetMutation.isPending}>
                  {createAssetMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create Asset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {editingAsset && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Asset</DialogTitle>
              <DialogDescription>Update asset details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input data-testid="input-edit-asset-name" value={editingAsset.name} onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={editingAsset.locationId || ""} onValueChange={(val) => setEditingAsset({ ...editingAsset, locationId: val })}>
                  <SelectTrigger data-testid="select-edit-asset-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sitesData as any[]).map((site: any) => {
                      const siteLocs = (locationsData as any[]).filter((l: any) => l.siteId === site.id);
                      if (siteLocs.length === 0) return null;
                      return (
                        <SelectGroup key={site.id}>
                          <SelectLabel className="font-semibold text-primary/70">{site.name}</SelectLabel>
                          {siteLocs.map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingAsset.status} onValueChange={(val) => setEditingAsset({ ...editingAsset, status: val })}>
                  <SelectTrigger data-testid="select-edit-asset-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Health (%)</Label>
                <Input data-testid="input-edit-asset-health" type="number" min={0} max={100} value={editingAsset.health} onChange={(e) => setEditingAsset({ ...editingAsset, health: parseInt(e.target.value) || 0 })} />
              </div>
              <AssetDetailFields value={editingAsset} onChange={setEditingAsset} assets={assets as any[]} prefix="input-edit-asset" />
            </div>
            <DialogFooter>
              <Button data-testid="button-save-asset" onClick={handleEditAsset} disabled={updateAssetMutation.isPending}>
                {updateAssetMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue="list" className="mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2" data-testid="tab-list"><List className="size-4" /> List View</TabsTrigger>
            <TabsTrigger value="topology" className="gap-2" data-testid="tab-topology"><FolderTree className="size-4" /> Topology Map</TabsTrigger>
            <TabsTrigger value="drawing" className="gap-2" data-testid="tab-drawing"><MapIcon className="size-4" /> Floor Plan</TabsTrigger>
          </TabsList>
          
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input data-testid="input-search-assets" placeholder="Search assets..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex rounded-md border bg-background p-0.5" role="group" aria-label="Asset view">
              <Button
                variant={viewMode === "tiles" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5"
                onClick={() => chooseView("tiles")} aria-pressed={viewMode === "tiles"} title="Tiles" data-testid="button-view-tiles"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={viewMode === "rows" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5"
                onClick={() => chooseView("rows")} aria-pressed={viewMode === "rows"} title="List" data-testid="button-view-rows"
              >
                <Rows3 className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="list" className="space-y-4 m-0">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No assets found</p>
              <p className="text-sm mt-1">Try adjusting your search or add a new asset.</p>
            </div>
          ) : viewMode === "tiles" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredAssets.map((asset: any) => (
                <Card key={asset.id} className="overflow-hidden flex flex-col transition-all hover:shadow-md" data-testid={`card-asset-${asset.id}`}>
                  <div className="h-28 bg-muted/50 flex items-center justify-center border-b relative">
                    {asset.image ? (
                      <img src={asset.image} alt={asset.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="size-10 text-muted-foreground/30" />
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <AssetStatusBadge asset={asset} />
                      {asset.criticality && <Badge variant="secondary" className="text-xs" title="Criticality">Crit. {asset.criticality}</Badge>}
                    </div>
                    <div className="absolute top-1 right-1">
                      <AssetMenu asset={asset} onEdit={() => { setEditingAsset({ ...asset }); setEditDialogOpen(true); }} onMove={() => setMovingAsset(asset)} onDelete={() => handleDeleteAsset(asset.id)} />
                    </div>
                  </div>
                  <CardHeader className="p-4 pb-2 space-y-1">
                    <CardTitle className="text-base leading-snug line-clamp-2" data-testid={`text-asset-name-${asset.id}`}>{asset.name}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono" data-testid={`text-asset-id-${asset.id}`}>{asset.id}</span>
                      {asset.category && <><span>·</span><span className="truncate">{asset.category}</span></>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 mt-auto space-y-3">
                    <button
                      className="flex items-center gap-1.5 text-sm text-left hover:underline"
                      onClick={() => setMovingAsset(asset)} title="Change location"
                      data-testid={`button-change-location-${asset.id}`}
                    >
                      <MapPin className="size-3.5 opacity-70 shrink-0" />
                      <span className="truncate" data-testid={`text-asset-location-${asset.id}`}>{getLocationName(asset.locationId)}</span>
                    </button>
                    <HealthBar asset={asset} />
                    <div className="flex items-end justify-between text-sm">
                      <AssetPartsInfo assetId={asset.id} links={spareLinks} inventoryData={inventoryData as any[]} />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground flex items-center justify-end">
                          <Calendar className="mr-1 size-3 opacity-70" /> Last service
                        </p>
                        <p className="font-medium" data-testid={`text-asset-service-${asset.id}`}>{asset.lastService || "N/A"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="hidden sm:table-cell text-center">Crit.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell w-[140px]">Health</TableHead>
                      <TableHead className="hidden lg:table-cell">Spares</TableHead>
                      <TableHead className="hidden xl:table-cell">Last service</TableHead>
                      <TableHead className="w-[48px]"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((asset: any) => (
                      <TableRow key={asset.id} data-testid={`row-asset-${asset.id}`}>
                        <TableCell className="font-mono text-xs">{asset.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{asset.name}</div>
                          {(asset.manufacturer || asset.model) && (
                            <div className="text-xs text-muted-foreground">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{asset.category || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <button className="text-sm text-left hover:underline" onClick={() => setMovingAsset(asset)} title="Change location">
                            {getLocationName(asset.locationId)}
                          </button>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center">{asset.criticality || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><AssetStatusBadge asset={asset} /></TableCell>
                        <TableCell className="hidden lg:table-cell"><HealthBar asset={asset} compact /></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <AssetPartsInfo assetId={asset.id} links={spareLinks} inventoryData={inventoryData as any[]} compact />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm">{asset.lastService || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <AssetMenu asset={asset} onEdit={() => { setEditingAsset({ ...asset }); setEditDialogOpen(true); }} onMove={() => setMovingAsset(asset)} onDelete={() => handleDeleteAsset(asset.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Dialog open={!!movingAsset} onOpenChange={(open) => !open && setMovingAsset(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Move {movingAsset?.name}</DialogTitle>
                <DialogDescription>Choose the asset's new location.</DialogDescription>
              </DialogHeader>
              <Select
                onValueChange={(val) => { handleLocationChange(movingAsset.id, val); setMovingAsset(null); }}
                defaultValue={movingAsset?.locationId || undefined}
              >
                <SelectTrigger data-testid="select-move-location">
                  <SelectValue placeholder="Select new location" />
                </SelectTrigger>
                <SelectContent>
                  {(sitesData as any[]).map((site: any) => {
                    const siteLocs = (locationsData as any[]).filter((l: any) => l.siteId === site.id);
                    if (siteLocs.length === 0) return null;
                    return (
                      <SelectGroup key={site.id}>
                        <SelectLabel className="font-semibold text-primary/70">{site.name}</SelectLabel>
                        {siteLocs.map((loc: any) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            <div className="flex items-center">
                              {loc.name}
                              {movingAsset?.locationId === loc.id && <Check className="ml-2 size-3 text-green-500" />}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
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
                  {currentUser?.companyName ?? "Your company"}
                </div>
                
                <div className="pl-8 space-y-10 border-l-2 ml-3 border-primary/20 py-2">
                  {(sitesData as any[]).map((site: any) => {
                    const siteLocs = (locationsData as any[]).filter((l: any) => l.siteId === site.id);
                    return (
                      <div key={site.id} className="relative">
                        <div className="absolute -left-[35px] top-3 w-8 h-0.5 bg-primary/20"></div>
                        <div className="flex items-center gap-2 font-bold text-lg mb-6 text-foreground/90">
                          <MapPin className="size-5 text-blue-500" />
                          {site.name}
                        </div>
                        
                        <div className="pl-8 space-y-8 border-l ml-2.5 border-border">
                          {siteLocs.map((loc: any) => {
                            const locAssets = (assets as any[]).filter((a: any) => a.locationId === loc.id);
                            if (locAssets.length === 0) return null;
                            
                            const activeAssets = locAssets.filter((a: any) => ["Operational", "Maintenance", "Down"].includes(a.status));
                            const inactiveAssets = locAssets.filter((a: any) => ["Loaned Out", "In Storage"].includes(a.status));
                            
                            return (
                              <div key={loc.id} className="relative">
                                <div className="absolute -left-[33px] top-3 w-8 h-px bg-border"></div>
                                <div className="flex items-center gap-2 font-semibold mb-4 text-foreground/80">
                                  <Box className="size-4 text-muted-foreground" />
                                  {loc.name}
                                </div>
                                
                                <div className="pl-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {activeAssets.map((asset: any) => (
                                    <div key={asset.id} className="p-4 border rounded-lg bg-card shadow-sm flex flex-col gap-3 relative group hover:border-primary/50 transition-all hover:shadow-md cursor-pointer" data-testid={`topology-asset-${asset.id}`}>
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
                                  
                                  {inactiveAssets.map((asset: any) => (
                                    <div key={asset.id} className="p-4 border border-dashed rounded-lg bg-muted/20 flex flex-col gap-3 relative group opacity-80 hover:opacity-100 transition-opacity" data-testid={`topology-asset-${asset.id}`}>
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
                <Button variant="outline" size="sm" onClick={() => setUploadedDrawing(null)} data-testid="button-remove-drawing">
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
                  <Button onClick={() => setUploadedDrawing(floorplanImg)} className="gap-2" data-testid="button-browse-files">
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
                  
                  {(assets as any[]).slice(0, 3).map((asset: any, idx: number) => {
                    const positions = [
                      { top: "25%", left: "30%" },
                      { top: "45%", left: "65%" },
                      { top: "70%", left: "20%" },
                    ];
                    const pos = positions[idx];
                    const colorClass = asset.status === "Operational" ? "green" : asset.status === "Maintenance" ? "yellow" : "red";
                    return (
                      <div key={asset.id} className={`absolute -translate-x-1/2 -translate-y-1/2`} style={{ top: pos.top, left: pos.left }}>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <button className="flex flex-col items-center group cursor-pointer" data-testid={`floorplan-pin-${asset.id}`}>
                              <div className={cn(
                                `bg-${colorClass}-500 text-white rounded-full p-2 shadow-lg mb-1 group-hover:scale-110 transition-transform ring-4 ring-${colorClass}-500/20`,
                                asset.status === "Maintenance" && "animate-pulse"
                              )}>
                                <Activity className="size-4" />
                              </div>
                              <Badge variant="secondary" className={`shadow-sm font-bold border-${colorClass}-500/30`}>{asset.name}</Badge>
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-64">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold">{asset.name}</h4>
                              <Badge className={`bg-${colorClass}-500`}>{asset.status}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 mb-3">
                              <p>ID: {asset.id}</p>
                              <p>Health: {asset.health}%</p>
                            </div>
                            <Button size="sm" className="w-full h-8">View Details</Button>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    );
                  })}

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
