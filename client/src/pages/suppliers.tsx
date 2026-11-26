import Layout from "@/components/Layout";
import { useSuppliers, useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-data";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Mail,
  Phone,
  Star,
  Clock,
  Package,
  Building2,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";

function SupplierDialog({ 
  open, 
  onOpenChange, 
  supplier, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  supplier?: Supplier | null; 
  onSave: (data: any) => void;
}) {
  const isEdit = !!supplier;
  const [name, setName] = useState(supplier?.name ?? "");
  const [categories, setCategories] = useState(supplier?.categories?.join(", ") ?? "");
  const [rating, setRating] = useState(supplier?.rating ?? "4.0");
  const [supplierId, setSupplierId] = useState(supplier?.id ?? `SUP-${String(Date.now()).slice(-4)}`);
  const [leadTimeDays, setLeadTimeDays] = useState(supplier?.leadTimeDays == null ? "" : String(supplier.leadTimeDays));
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      name,
      categories: categories.split(",").map(c => c.trim()).filter(Boolean),
      rating: rating === "" ? null : rating,
      leadTimeDays: leadTimeDays.trim() === "" ? null : Math.max(0, parseInt(leadTimeDays, 10) || 0),
      contactName: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    if (!isEdit) {
      data.id = supplierId.trim();
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the supplier details below." : "Enter the details for the new supplier."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="supplier-id">Supplier ID</Label>
              <Input
                id="supplier-id"
                data-testid="input-supplier-id"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="supplier-name">Name</Label>
            <Input 
              id="supplier-name" 
              data-testid="input-supplier-name"
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-categories">Categories (comma-separated)</Label>
            <Input 
              id="supplier-categories" 
              data-testid="input-supplier-categories"
              value={categories} 
              onChange={e => setCategories(e.target.value)} 
              placeholder="e.g. Spares, Tools, Fluids"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-rating">Rating</Label>
              <Input 
                id="supplier-rating" 
                data-testid="input-supplier-rating"
                type="number" 
                step="0.1" 
                min="0" 
                max="5" 
                value={rating} 
                onChange={e => setRating(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-leadtime">Lead Time (days)</Label>
              <Input 
                id="supplier-leadtime" 
                data-testid="input-supplier-leadtime"
                type="number"
                min="0"
                value={leadTimeDays} 
                onChange={e => setLeadTimeDays(e.target.value)} 
                placeholder="e.g. 3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-contact-name">Contact Name</Label>
            <Input
              id="supplier-contact-name"
              data-testid="input-supplier-contact-name"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Email</Label>
              <Input 
                id="supplier-contact" 
                data-testid="input-supplier-contact"
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                data-testid="input-supplier-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-supplier">
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save-supplier">
              {isEdit ? "Save Changes" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const { data: suppliersData, isLoading } = useSuppliers();
  const suppliersList: Supplier[] = Array.isArray(suppliersData) ? suppliersData : [];

  const createMutation = useCreateMutation("/api/suppliers", ["/api/suppliers"]);
  const updateMutation = useUpdateMutation("/api/suppliers", ["/api/suppliers"]);
  const deleteMutation = useDeleteMutation("/api/suppliers", ["/api/suppliers"]);

  const filteredSuppliers = suppliersList.filter(sup => 
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (sup.categories || []).some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAdd = () => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleSave = (data: any) => {
    if (editingSupplier) {
      updateMutation.mutate(
        { id: editingSupplier.id, data },
        {
          onSuccess: () => {
            toast({ title: "Supplier updated successfully" });
            setDialogOpen(false);
            setEditingSupplier(null);
          },
          onError: (err: any) => {
            toast({ title: "Error updating supplier", description: err.message, variant: "destructive" });
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast({ title: "Supplier added successfully" });
          setDialogOpen(false);
        },
        onError: (err: any) => {
          toast({ title: "Error adding supplier", description: err.message, variant: "destructive" });
        },
      });
    }
  };

  const handleDelete = (supplier: Supplier) => {
    deleteMutation.mutate(supplier.id, {
      onSuccess: () => {
        toast({ title: "Supplier deleted" });
      },
      onError: (err: any) => {
        toast({ title: "Error deleting supplier", description: err.message, variant: "destructive" });
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-suppliers-title">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage vendor database and approved categories.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAdd} data-testid="button-add-supplier">
            <Plus className="mr-2 size-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9" 
            data-testid="input-search-suppliers"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSuppliers.map((supplier) => (
          <Card key={supplier.id} className="flex flex-col h-full hover:shadow-md transition-shadow" data-testid={`card-supplier-${supplier.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-muted/50 flex items-center justify-center border">
                    <Building2 className="size-5 text-muted-foreground/70" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold leading-tight" data-testid={`text-supplier-name-${supplier.id}`}>{supplier.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-0.5">{supplier.id}</CardDescription>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8" data-testid={`button-supplier-menu-${supplier.id}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Supplier Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleEdit(supplier)} data-testid={`button-edit-supplier-${supplier.id}`}>
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(supplier)} 
                      className="text-destructive"
                      data-testid={`button-delete-supplier-${supplier.id}`}
                    >
                      Delete Supplier
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4 flex flex-col gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center">
                  <Package className="mr-1.5 size-3.5" /> Approved Categories
                </h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(supplier.categories || []).map(category => (
                    <Badge key={category} variant="secondary" className="font-normal bg-muted border-none">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center">
                    <Star className="mr-1.5 size-3 text-yellow-500 fill-yellow-500" /> Rating
                  </p>
                  <p className="text-sm font-medium" data-testid={`text-supplier-rating-${supplier.id}`}>{supplier.rating} / 5.0</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground flex items-center justify-end">
                    <Clock className="mr-1.5 size-3 opacity-70" /> Avg. Lead Time
                  </p>
                  <p className="text-sm font-medium">{supplier.leadTimeDays == null ? "—" : `${supplier.leadTimeDays} day${supplier.leadTimeDays === 1 ? "" : "s"}`}</p>
                </div>
              </div>
              
              {(supplier.contactName || supplier.email || supplier.phone) && (
                <div className="bg-muted/30 p-2 rounded-md border text-sm space-y-1">
                  {supplier.contactName && <div className="font-medium">{supplier.contactName}</div>}
                  {supplier.email && (
                    <div className="flex items-center">
                      <Mail className="size-4 text-muted-foreground mr-2 shrink-0" />
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline truncate" data-testid={`link-supplier-email-${supplier.id}`}>
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center">
                      <Phone className="size-4 text-muted-foreground mr-2 shrink-0" />
                      <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className="hover:underline">{supplier.phone}</a>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <SupplierDialog
        key={editingSupplier?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        onSave={handleSave}
      />
    </Layout>
  );
}
