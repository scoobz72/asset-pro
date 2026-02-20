import Layout from "@/components/Layout";
import { suppliers } from "@/lib/mockData";
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
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Mail,
  Star,
  Clock,
  Package,
  Building2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSuppliers = suppliers.filter(sup => 
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sup.categories.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage vendor database and approved categories.</p>
        </div>
        <div className="flex gap-2">
          <Button>
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
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSuppliers.map((supplier) => (
          <Card key={supplier.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-muted/50 flex items-center justify-center border">
                    <Building2 className="size-5 text-muted-foreground/70" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold leading-tight">{supplier.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-0.5">{supplier.id}</CardDescription>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Supplier Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Edit Details</DropdownMenuItem>
                    <DropdownMenuItem>View Purchase Orders</DropdownMenuItem>
                    <DropdownMenuItem>Update Categories</DropdownMenuItem>
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
                  {supplier.categories.map(category => (
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
                  <p className="text-sm font-medium">{supplier.rating} / 5.0</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground flex items-center justify-end">
                    <Clock className="mr-1.5 size-3 opacity-70" /> Avg. Lead Time
                  </p>
                  <p className="text-sm font-medium">{supplier.leadTime}</p>
                </div>
              </div>
              
              <div className="bg-muted/30 p-2 rounded-md border flex items-center text-sm">
                <Mail className="size-4 text-muted-foreground mr-2 shrink-0" />
                <a href={`mailto:${supplier.contact}`} className="text-blue-600 hover:underline truncate">
                  {supplier.contact}
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
