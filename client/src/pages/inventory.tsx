import Layout from "@/components/Layout";
import { inventory, assets } from "@/lib/mockData";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Plus, 
  AlertCircle, 
  ShoppingCart,
  Image as ImageIcon,
  MoreHorizontal
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
import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export default function Inventory() {
  const [filterLowStock, setFilterLowStock] = useState(false);
  
  const displayedInventory = filterLowStock 
    ? inventory.filter(i => i.stock < i.minStock)
    : inventory;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Track parts, stock levels, and requisitions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ShoppingCart className="mr-2 size-4" />
            Purchase Order
          </Button>
          <Button>
            <Plus className="mr-2 size-4" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 my-6">
        <div className="bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <ShoppingCart className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Items</p>
            <h3 className="text-2xl font-bold">{inventory.reduce((acc, item) => acc + item.stock, 0)}</h3>
          </div>
        </div>
        <div 
          className={cn(
            "bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:bg-muted/50",
            filterLowStock && "border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-950/20"
          )}
          onClick={() => setFilterLowStock(!filterLowStock)}
        >
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-500">{inventory.filter(i => i.stock < i.minStock).length}</h3>
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <ShoppingCart className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Value</p>
            <h3 className="text-2xl font-bold">$12,450</h3>
          </div>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search inventory..." className="pl-9" />
        </div>
        {filterLowStock && (
          <Button variant="ghost" onClick={() => setFilterLowStock(false)} className="text-sm text-muted-foreground h-9">
            Clear filter
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead className="w-[100px]">Part #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Used On</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Last Stock Taken</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedInventory.map((item) => {
              const stockPercentage = Math.min((item.stock / (item.minStock * 3)) * 100, 100);
              const isLow = item.stock < item.minStock;

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="size-10 rounded bg-muted/50 border flex items-center justify-center relative group overflow-hidden cursor-pointer">
                      <ImageIcon className="size-4 text-muted-foreground/50" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="size-3 text-white" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-xs text-muted-foreground">
                    {item.id}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell className="w-[180px]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{item.stock} {item.unit}</span>
                        <span className="text-muted-foreground">Min: {item.minStock}</span>
                      </div>
                      <Progress value={stockPercentage} className={cn(
                        "h-1.5",
                        isLow ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"
                      )} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {isLow ? (
                      <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-[180px]">
                    {item.usedOnAssets && item.usedOnAssets.length > 0 ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-xs">
                            {item.usedOnAssets.length} Asset(s)
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Used on Assets</h4>
                            <div className="text-sm">
                              {item.usedOnAssets.map(assetId => {
                                const asset = assets.find(a => a.id === assetId);
                                return (
                                  <div key={assetId} className="flex justify-between items-center py-1 border-b last:border-0">
                                    <span>{asset?.name || assetId}</span>
                                    <span className="text-xs text-muted-foreground">{assetId}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.lastUsed}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.lastStockTaken}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Item Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Edit Item</DropdownMenuItem>
                        <DropdownMenuItem>Upload Image</DropdownMenuItem>
                        <DropdownMenuItem>Adjust Stock</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Order More</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
