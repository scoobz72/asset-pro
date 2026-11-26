import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MapPin, Building2, Edit2, Trash2, Loader2, Warehouse, Archive } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useSites, useLocations, useStoreRooms, useBins,
  useCreateMutation, useUpdateMutation, useDeleteMutation,
} from "@/hooks/use-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Site, Location, StoreRoom, Bin } from "@shared/schema";
import { LOCATION_TYPES } from "@shared/constants";

type Field = {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  /** IDs can be typed when creating a record but never changed afterwards. */
  idField?: boolean;
};

type DialogState = {
  title: string;
  description?: string;
  fields: Field[];
  values: Record<string, string>;
  isEdit: boolean;
  submit: (values: Record<string, string>) => Promise<unknown>;
};

/** One add/edit dialog for sites, locations, store rooms and bins. */
function RecordDialog({ state, onClose }: { state: DialogState | null; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const [openedFor, setOpenedFor] = useState<DialogState | null>(null);

  if (state !== openedFor) {
    setOpenedFor(state);
    setValues(state?.values ?? {});
  }
  if (!state) return null;

  const missing = state.fields.some((f) => f.required && !(values[f.key] ?? "").trim());

  const handleSubmit = async () => {
    setPending(true);
    try {
      await state.submit(values);
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && <DialogDescription>{state.description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          {state.fields.map((f) => {
            if (f.idField && state.isEdit) return null;
            const id = `field-${f.key}`;
            return (
              <div className="space-y-2" key={f.key}>
                <Label htmlFor={id}>{f.label}{f.required && " *"}</Label>
                {f.options ? (
                  <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                    <SelectTrigger id={id} data-testid={`select-${f.key}`}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    data-testid={`input-${f.key}`}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && !missing && !pending && handleSubmit()}
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-confirm-record" onClick={handleSubmit} disabled={missing || pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {state.isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trims every value and turns blanks into null so optional columns are cleared, not set to "". */
function clean(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
}

export default function Locations() {
  const { data: sites = [], isLoading: sitesLoading } = useSites();
  const { data: locs = [], isLoading: locsLoading } = useLocations();
  const { data: rooms = [], isLoading: roomsLoading } = useStoreRooms();
  const { data: bins = [], isLoading: binsLoading } = useBins();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { toast } = useToast();

  const createSite = useCreateMutation("/api/sites", ["/api/sites"]);
  const updateSite = useUpdateMutation("/api/sites", ["/api/sites"]);
  const createLocation = useCreateMutation("/api/locations", ["/api/locations"]);
  const updateLocation = useUpdateMutation("/api/locations", ["/api/locations"]);
  const deleteLocation = useDeleteMutation("/api/locations", ["/api/locations"]);
  const createRoom = useCreateMutation("/api/store-rooms", ["/api/store-rooms"]);
  const updateRoom = useUpdateMutation("/api/store-rooms", ["/api/store-rooms"]);
  const deleteRoom = useDeleteMutation("/api/store-rooms", ["/api/store-rooms"]);
  const createBin = useCreateMutation("/api/bins", ["/api/bins"]);
  const updateBin = useUpdateMutation("/api/bins", ["/api/bins"]);
  const deleteBin = useDeleteMutation("/api/bins", ["/api/bins", "/api/inventory"]);

  const isLoading = sitesLoading || locsLoading || roomsLoading || binsLoading;
  const q = searchTerm.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q));

  const remove = (mutation: ReturnType<typeof useDeleteMutation>, id: string, what: string) => {
    if (!window.confirm(`Delete ${what} ${id}? This can't be undone.`)) return;
    mutation.mutate(id, {
      onSuccess: () => toast({ title: `${what[0].toUpperCase()}${what.slice(1)} deleted` }),
      onError: (err: any) => toast({ title: "Couldn't delete", description: err.message, variant: "destructive" }),
    });
  };

  const siteFields: Field[] = [
    { key: "id", label: "Site ID", required: true, placeholder: "e.g. SITE-01", idField: true },
    { key: "name", label: "Site name", required: true, placeholder: "e.g. Main Production Facility" },
    { key: "address", label: "Address" },
    { key: "postcode", label: "Postcode" },
  ];
  const locationFields: Field[] = [
    { key: "id", label: "Location ID", required: true, placeholder: "e.g. LINE-1", idField: true },
    { key: "name", label: "Name", required: true },
    { key: "type", label: "Type", required: true, options: LOCATION_TYPES },
  ];
  const roomFields: Field[] = [
    { key: "id", label: "Store room ID", required: true, placeholder: "e.g. STORE-A", idField: true },
    { key: "name", label: "Name", required: true, placeholder: "e.g. Engineering Stores" },
  ];
  const binFields: Field[] = [
    { key: "id", label: "Bin ID", required: true, placeholder: "e.g. BIN-A01", idField: true },
    { key: "description", label: "Description", placeholder: "e.g. Rack A, shelf 1" },
  ];

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
          <p className="text-muted-foreground mt-1">Sites, the areas where assets are installed, and the store rooms and bins that hold spares.</p>
        </div>
        <Button
          data-testid="button-add-site"
          onClick={() => setDialog({
            title: "Add site", fields: siteFields, values: { id: "", name: "", address: "", postcode: "" }, isEdit: false,
            submit: (v) => createSite.mutateAsync(clean(v)),
          })}
        >
          <Plus className="mr-2 size-4" /> Add Site
        </Button>
      </div>

      <div className="flex items-center mb-6 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            data-testid="input-search-locations"
            placeholder="Search sites, locations, store rooms, bins..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {(sites as Site[]).length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          No sites yet. Add your first site, or import them from Settings → Data Import.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {(sites as Site[]).map((site) => {
          const siteMatches = matches(site.name, site.id, site.postcode);
          const siteLocations = (locs as Location[]).filter((l) => l.siteId === site.id && (siteMatches || matches(l.name, l.id, l.type)));
          const siteRooms = (rooms as StoreRoom[]).filter((r) => r.siteId === site.id);
          const visibleRooms = siteRooms.filter((r) => siteMatches || matches(r.name, r.id) ||
            (bins as Bin[]).some((b) => b.storeRoomId === r.id && matches(b.id, b.description)));
          if (q && !siteMatches && siteLocations.length === 0 && visibleRooms.length === 0) return null;

          return (
            <Card key={site.id} className="shadow-sm" data-testid={`card-site-${site.id}`}>
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-site-name-${site.id}`}>{site.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {site.id}
                        {(site.address || site.postcode) && <> · {[site.address, site.postcode].filter(Boolean).join(", ")}</>}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit site"
                    data-testid={`button-edit-site-${site.id}`}
                    onClick={() => setDialog({
                      title: `Edit site ${site.id}`, fields: siteFields, isEdit: true,
                      values: { name: site.name, address: site.address ?? "", postcode: site.postcode ?? "" },
                      submit: (v) => updateSite.mutateAsync({ id: site.id, data: clean(v) }),
                    })}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <SectionHeader
                  icon={<MapPin className="size-4" />}
                  title="Asset locations"
                  onAdd={() => setDialog({
                    title: `Add location to ${site.name}`, fields: locationFields, isEdit: false,
                    values: { id: "", name: "", type: "Production area" },
                    submit: (v) => createLocation.mutateAsync({ ...clean(v), siteId: site.id }),
                  })}
                  testId={`button-add-location-${site.id}`}
                />
                <div className="divide-y">
                  {siteLocations.map((loc) => (
                    <Row
                      key={loc.id}
                      testId={`row-location-${loc.id}`}
                      name={loc.name}
                      id={loc.id}
                      badge={loc.type}
                      onEdit={() => setDialog({
                        title: `Edit location ${loc.id}`, fields: locationFields, isEdit: true,
                        values: { name: loc.name, type: loc.type },
                        submit: (v) => updateLocation.mutateAsync({ id: loc.id, data: clean(v) }),
                      })}
                      onDelete={() => remove(deleteLocation, loc.id, "location")}
                    />
                  ))}
                  {siteLocations.length === 0 && <Empty text="No asset locations yet." />}
                </div>

                <SectionHeader
                  icon={<Warehouse className="size-4" />}
                  title="Store rooms & bins"
                  onAdd={() => setDialog({
                    title: `Add store room to ${site.name}`, fields: roomFields, isEdit: false,
                    values: { id: "", name: "" },
                    submit: (v) => createRoom.mutateAsync({ ...clean(v), siteId: site.id }),
                  })}
                  testId={`button-add-store-room-${site.id}`}
                />
                <div className="divide-y">
                  {visibleRooms.map((room) => {
                    const roomBins = (bins as Bin[]).filter((b) => b.storeRoomId === room.id);
                    return (
                      <div key={room.id} data-testid={`row-store-room-${room.id}`}>
                        <Row
                          name={room.name}
                          id={room.id}
                          badge={`${roomBins.length} bin${roomBins.length === 1 ? "" : "s"}`}
                          onEdit={() => setDialog({
                            title: `Edit store room ${room.id}`, fields: roomFields, isEdit: true,
                            values: { name: room.name },
                            submit: (v) => updateRoom.mutateAsync({ id: room.id, data: clean(v) }),
                          })}
                          onDelete={() => remove(deleteRoom, room.id, "store room")}
                          extra={
                            <Button
                              variant="outline" size="sm" className="h-7 text-xs"
                              data-testid={`button-add-bin-${room.id}`}
                              onClick={() => setDialog({
                                title: `Add bin to ${room.name}`, fields: binFields, isEdit: false,
                                values: { id: "", description: "" },
                                submit: (v) => createBin.mutateAsync({ ...clean(v), storeRoomId: room.id }),
                              })}
                            >
                              <Plus className="mr-1 size-3" /> Bin
                            </Button>
                          }
                        />
                        {roomBins.length > 0 && (
                          <div className="flex flex-wrap gap-2 px-11 pb-4">
                            {roomBins.map((bin) => (
                              <span
                                key={bin.id}
                                className="group inline-flex items-center gap-1 rounded-md border bg-muted/30 pl-2 pr-1 py-0.5 text-xs"
                                data-testid={`chip-bin-${bin.id}`}
                                title={bin.description ?? undefined}
                              >
                                <Archive className="size-3 text-muted-foreground" />
                                <span className="font-mono">{bin.id}</span>
                                {bin.description && <span className="text-muted-foreground hidden sm:inline">– {bin.description}</span>}
                                <button
                                  className="ml-1 p-0.5 rounded hover:bg-muted" aria-label={`Edit bin ${bin.id}`}
                                  onClick={() => setDialog({
                                    title: `Edit bin ${bin.id}`, fields: binFields, isEdit: true,
                                    values: { description: bin.description ?? "" },
                                    submit: (v) => updateBin.mutateAsync({ id: bin.id, data: clean(v) }),
                                  })}
                                >
                                  <Edit2 className="size-3" />
                                </button>
                                <button
                                  className="p-0.5 rounded hover:bg-muted text-destructive" aria-label={`Delete bin ${bin.id}`}
                                  onClick={() => remove(deleteBin, bin.id, "bin")}
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {visibleRooms.length === 0 && <Empty text="No store rooms yet." />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RecordDialog state={dialog} onClose={() => setDialog(null)} />
    </Layout>
  );
}

function SectionHeader({ icon, title, onAdd, testId }: { icon: React.ReactNode; title: string; onAdd: () => void; testId: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/10 border-b border-t first:border-t-0">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </span>
      <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={testId} onClick={onAdd}>
        <Plus className="mr-1 size-3" /> Add
      </Button>
    </div>
  );
}

function Row({ name, id, badge, onEdit, onDelete, extra, testId }: {
  name: string; id: string; badge?: string; onEdit: () => void; onDelete: () => void; extra?: React.ReactNode; testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-4 hover:bg-muted/30 transition-colors" data-testid={testId}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="font-medium text-sm truncate">{name}</span>
        {badge && <Badge variant="secondary" className="text-[10px] shrink-0">{badge}</Badge>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground mr-1">{id}</Badge>
        {extra}
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${id}`} onClick={onEdit}>
          <Edit2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${id}`} onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-6 text-center text-muted-foreground text-sm">{text}</div>;
}
