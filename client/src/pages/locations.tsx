import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MapPin, Building2, Edit2, Trash2, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSites, useLocations, useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Site, Location } from "@shared/schema";

export default function Locations() {
  const { data: sites = [], isLoading: sitesLoading } = useSites();
  const { data: locs = [], isLoading: locsLoading } = useLocations();
  const [searchTerm, setSearchTerm] = useState("");
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const { toast } = useToast();

  const createSite = useCreateMutation("/api/sites", ["/api/sites"]);
  const createLocation = useCreateMutation("/api/locations", ["/api/locations"]);
  const updateLocation = useUpdateMutation("/api/locations", ["/api/locations"]);
  const deleteLocation = useDeleteMutation("/api/locations", ["/api/locations"]);

  const isLoading = sitesLoading || locsLoading;

  const handleAddSite = () => {
    if (!newSiteName.trim()) return;
    const id = `SITE-${Date.now()}`;
    createSite.mutate({ id, name: newSiteName.trim() }, {
      onSuccess: () => {
        toast({ title: "Site Created", description: `"${newSiteName.trim()}" has been added.` });
        setNewSiteName("");
        setAddSiteOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleAddLocation = (siteId: string) => {
    const id = `LOC-${Date.now()}`;
    createLocation.mutate({ id, name: "New Location", siteId }, {
      onSuccess: () => {
        toast({ title: "Location Added", description: "A new location has been created." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleSaveLocation = (id: string, newName: string) => {
    updateLocation.mutate({ id, data: { name: newName } }, {
      onSuccess: () => {
        toast({ title: "Location Updated", description: "The location name has been updated successfully." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleDeleteLocation = (id: string) => {
    deleteLocation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Location Deleted", description: "The location has been removed." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Locations</h1>
          <p className="text-muted-foreground mt-1">Manage sites and their physical locations for asset tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="button-add-site" onClick={() => setAddSiteOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Site
          </Button>
        </div>
      </div>

      <div className="flex items-center mb-6 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            data-testid="input-search-locations"
            placeholder="Search locations or sites..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {(sites as Site[]).map((site: Site) => {
          const siteLocations = (locs as Location[]).filter(
            (l: Location) =>
              l.siteId === site.id &&
              (l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                site.name.toLowerCase().includes(searchTerm.toLowerCase()))
          );

          if (siteLocations.length === 0 && searchTerm !== "") return null;

          return (
            <Card key={site.id} className="shadow-sm" data-testid={`card-site-${site.id}`}>
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-site-name-${site.id}`}>{site.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{site.id}</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`button-add-location-${site.id}`}
                    onClick={() => handleAddLocation(site.id)}
                  >
                    <Plus className="mr-2 size-3" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {siteLocations.map((loc: Location) => (
                    <LocationRow
                      key={loc.id}
                      location={loc}
                      onSave={handleSaveLocation}
                      onDelete={handleDeleteLocation}
                    />
                  ))}
                  {siteLocations.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No locations found for this site.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site Name</Label>
              <Input
                id="site-name"
                data-testid="input-new-site-name"
                placeholder="e.g. Main Production Facility"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSite()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSiteOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-confirm-add-site"
              onClick={handleAddSite}
              disabled={!newSiteName.trim() || createSite.isPending}
            >
              {createSite.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function LocationRow({ location, onSave, onDelete }: { location: Location; onSave: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(location.name);

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors" data-testid={`row-location-${location.id}`}>
      <div className="flex items-center gap-3 flex-1">
        <MapPin className="size-4 text-muted-foreground" />
        {isEditing ? (
          <Input
            data-testid={`input-edit-location-${location.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 max-w-[200px]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSave(location.id, name);
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <span className="font-medium text-sm" data-testid={`text-location-name-${location.id}`}>{location.name}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground mr-2">
          {location.id}
        </Badge>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600"
            data-testid={`button-save-location-${location.id}`}
            onClick={() => {
              onSave(location.id, name);
              setIsEditing(false);
            }}
          >
            <Save className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            data-testid={`button-edit-location-${location.id}`}
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          data-testid={`button-delete-location-${location.id}`}
          onClick={() => onDelete(location.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
