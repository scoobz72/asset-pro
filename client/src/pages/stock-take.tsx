import Layout from "@/components/Layout";
import { useState } from "react";
import { inventory, locations } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  CheckCircle2, 
  ClipboardList, 
  Search,
  ArrowRight,
  Save,
  AlertTriangle,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Link } from "wouter";

export default function StockTake() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [countedItems, setCountedItems] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  
  // Get unique locations from inventory, or use the locations list
  const inventoryLocations = Array.from(new Set(inventory.map(item => item.location))).sort();

  const handleLocationToggle = (loc: string) => {
    setSelectedLocations(prev => 
      prev.includes(loc) 
        ? prev.filter(l => l !== loc)
        : [...prev, loc]
    );
  };

  const startStockTake = () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "No locations selected",
        description: "Please select at least one store room or bin to count.",
        variant: "destructive"
      });
      return;
    }
    
    // Initialize count state with current stock
    const initialCounts: Record<string, number> = {};
    const initialReasons: Record<string, string> = {};
    filteredInventory.forEach(item => {
      initialCounts[item.id] = item.stock;
    });
    setCountedItems(initialCounts);
    setReasons(initialReasons);
    setStep(2);
  };

  const handleCountChange = (id: string, value: string, currentStock: number) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setCountedItems(prev => ({ ...prev, [id]: num }));
      
      // Auto-assign default reasons based on variance
      const variance = num - currentStock;
      if (variance > 0) {
        setReasons(prev => ({ ...prev, [id]: "Stock In" }));
      } else if (variance < 0) {
        setReasons(prev => ({ ...prev, [id]: "Stock Out - Missing" }));
      } else {
        setReasons(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } else if (value === "") {
      // Allow empty temporarily while typing, but default to 0 on blur
      setCountedItems(prev => {
        const next = { ...prev };
        delete next[id]; // removes it so input becomes empty
        return next;
      });
      setReasons(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleReasonChange = (id: string, reason: string) => {
    setReasons(prev => ({ ...prev, [id]: reason }));
  };

  const submitStockTake = () => {
    toast({
      title: "Cycle Check Completed",
      description: `Successfully updated stock counts. Date stamps and reasons have been logged.`,
    });
    // In a real app, this would create transaction logs with the selected reasons and date stamps
    setTimeout(() => {
      setStep(1);
      setSelectedLocations([]);
      setCountedItems({});
      setReasons({});
    }, 1500);
  };

  const filteredInventory = inventory.filter(item => 
    selectedLocations.includes(item.location) &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     item.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Check</h1>
          <p className="text-muted-foreground mt-1">Audit and update inventory levels with discrepancy reasons.</p>
        </div>
        <div className="flex gap-2">
          {step === 1 && (
            <Link href="/transactions">
              <Button variant="outline" className="gap-2">
                <History className="size-4" /> View Activity Logs
              </Button>
            </Link>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back to Selection
              </Button>
              <Button onClick={submitStockTake} className="gap-2">
                <Save className="size-4" /> Complete Cycle Check
              </Button>
            </>
          )}
        </div>
      </div>

      {step === 1 ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClipboardList className="mr-2 size-5 text-primary" />
                Select Locations
              </CardTitle>
              <CardDescription>
                Choose the store rooms or bins you want to cycle check.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-4 border-b">
                  <Checkbox 
                    id="select-all" 
                    checked={selectedLocations.length === inventoryLocations.length && inventoryLocations.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedLocations([...inventoryLocations]);
                      } else {
                        setSelectedLocations([]);
                      }
                    }}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Select All Locations
                  </label>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4">
                  {inventoryLocations.map((loc) => (
                    <div key={loc} className="flex items-center space-x-3 bg-muted/30 p-3 rounded-md hover:bg-muted/50 transition-colors">
                      <Checkbox 
                        id={`loc-${loc}`} 
                        checked={selectedLocations.includes(loc)}
                        onCheckedChange={() => handleLocationToggle(loc)}
                      />
                      <div className="flex-1">
                        <label htmlFor={`loc-${loc}`} className="text-sm font-medium leading-none cursor-pointer flex justify-between w-full">
                          <span>{loc}</span>
                          <Badge variant="secondary" className="text-xs">
                            {inventory.filter(i => i.location === loc).length} items
                          </Badge>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button onClick={startStockTake} disabled={selectedLocations.length === 0} className="gap-2 w-full md:w-auto">
                    Start Counting <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="hidden md:flex flex-col justify-center items-center text-center p-8 bg-muted/20 rounded-xl border border-dashed">
            <div className="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="size-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Cycle Checks</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Perform targeted audits on specific bins or store rooms. You'll be asked to provide reasons for any stock variances, which will be logged with date stamps.
            </p>
          </div>
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Count Items</CardTitle>
                <CardDescription className="flex items-center mt-1">
                  Counting {filteredInventory.length} items across {selectedLocations.length} locations.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter items..." 
                  className="pl-9 bg-background" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedLocations.map(loc => (
                <Badge key={loc} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{loc}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px] px-4">Part #</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">System Stock</TableHead>
                  <TableHead className="w-[150px] text-right px-4">Actual Count</TableHead>
                  <TableHead className="w-[100px] text-center">Variance</TableHead>
                  <TableHead className="w-[200px]">Reason for Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No items found for the selected locations.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item) => {
                    const count = countedItems[item.id] !== undefined ? countedItems[item.id] : '';
                    const numCount = typeof count === 'number' ? count : 0;
                    const variance = numCount - item.stock;
                    const hasVariance = variance !== 0 && typeof count === 'number';
                    
                    return (
                      <TableRow key={item.id} className={cn(hasVariance && "bg-orange-50/50 dark:bg-orange-950/20")}>
                        <TableCell className="font-mono text-xs px-4">{item.id}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.location}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.stock} {item.unit}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Input 
                              type="number" 
                              min="0"
                              className={cn(
                                "w-24 text-right font-medium text-base h-10",
                                hasVariance && "border-orange-300 focus-visible:ring-orange-500"
                              )}
                              value={count}
                              onChange={(e) => handleCountChange(item.id, e.target.value, item.stock)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  handleCountChange(item.id, "0", item.stock);
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {hasVariance ? (
                            <div className="flex items-center justify-center text-xs font-bold">
                              <span className={variance > 0 ? "text-green-600" : "text-red-600"}>
                                {variance > 0 ? "+" : ""}{variance}
                              </span>
                              <AlertTriangle className="size-3 ml-1 text-orange-500" />
                            </div>
                          ) : (
                            <CheckCircle2 className="size-4 text-green-500 mx-auto opacity-50" />
                          )}
                        </TableCell>
                        <TableCell>
                          {hasVariance ? (
                            <Select 
                              value={reasons[item.id] || ""} 
                              onValueChange={(val) => handleReasonChange(item.id, val)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select Reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {variance > 0 ? (
                                  <>
                                    <SelectItem value="Stock In">Stock In (Found)</SelectItem>
                                    <SelectItem value="Data Entry Error">Data Entry Error Correction</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="Stock Out - Missing">Stock Out - Missing</SelectItem>
                                    <SelectItem value="Stock Out - Damaged">Stock Out - Damaged</SelectItem>
                                    <SelectItem value="Expired/Obsolete">Expired / Obsolete</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground italic pl-3">No variance</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
