import Layout from "@/components/Layout";
import { locations, sites } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MapPin, Building2, Edit2, Trash2, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Locations() {
  const [locs, setLocs] = useState(locations);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const handleSaveLocation = (id: string, newName: string) => {
    setLocs(locs.map(l => l.id === id ? { ...l, name: newName } : l));
    toast({
      title: "Location Updated",
      description: "The location name has been updated successfully.",
    });
  };

  const handleAddLocation = (siteId: string) => {
    const newLoc = {
      id: `LOC-NEW-${Date.now()}`,
      name: "New Location",
      siteId
    };
    setLocs([...locs, newLoc]);
  };

  const handleDeleteLocation = (id: string) => {
    setLocs(locs.filter(l => l.id !== id));
    toast({
      title: "Location Deleted",
      description: "The location has been removed.",
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-1">Manage sites and their physical locations for asset tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Plus className="mr-2 size-4" />
            Add Site
          </Button>
        </div>
      </div>

      <div className="flex items-center mb-6 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search locations or sites..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {sites.map(site => {
          const siteLocations = locs.filter(l => l.siteId === site.id && (l.name.toLowerCase().includes(searchTerm.toLowerCase()) || site.name.toLowerCase().includes(searchTerm.toLowerCase())));
          
          if (siteLocations.length === 0 && searchTerm !== "") return null;

          return (
            <Card key={site.id} className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{site.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{site.id}</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleAddLocation(site.id)}>
                    <Plus className="mr-2 size-3" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {siteLocations.map(loc => (
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
    </Layout>
  );
}

function LocationRow({ location, onSave, onDelete }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(location.name);

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <MapPin className="size-4 text-muted-foreground" />
        {isEditing ? (
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="h-8 max-w-[200px]"
            autoFocus
          />
        ) : (
          <span className="font-medium text-sm">{location.name}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground mr-2">
          {location.id}
        </Badge>
        {isEditing ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => {
            onSave(location.id, name);
            setIsEditing(false);
          }}>
            <Save className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
            <Edit2 className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(location.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
