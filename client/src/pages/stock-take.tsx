import Layout from "@/components/Layout";
import { useState } from "react";
import { useInventory, useLocations, useBins, useStoreRooms } from "@/hooks/use-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
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
  History,
  Loader2
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: inventoryData = [], isLoading: inventoryLoading } = useInventory();
  const { data: locationsData = [], isLoading: locationsLoading } = useLocations();

  const inventory = inventoryData as any[];

  const { data: binsData = [] } = useBins();
  const { data: storeRoomsData = [] } = useStoreRooms();
  const bins = binsData as any[];
  const storeRooms = storeRoomsData as any[];

  /** Stock is counted by store room: the room that holds the part's bin. */
  const NO_BIN = "No bin assigned";
  const areaOf = (item: any): string => {
    const bin = bins.find((b) => b.id === item.binId);
    const room = bin && storeRooms.find((r) => r.id === bin.storeRoomId);
    return room ? room.name : NO_BIN;
  };

  const inventoryLocations = Array.from(new Set(inventory.map(areaOf))).sort((a, b) =>
    a === NO_BIN ? 1 : b === NO_BIN ? -1 : a.localeCompare(b));

  const handleLocationToggle = (loc: string) => {
    setSelectedLocations(prev => 
      prev.includes(loc) 
        ? prev.filter(l => l !== loc)
        : [...prev, loc]
    );
  };

  const filteredInventory = inventory.filter((item: any) => 
    selectedLocations.includes(areaOf(item)) &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     item.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const startStockTake = () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "No store rooms selected",
        description: "Please select at least one store room or bin to count.",
        variant: "destructive"
      });
      return;
    }
    
    const initialCounts: Record<string, number> = {};
    const initialReasons: Record<string, string> = {};
    filteredInventory.forEach((item: any) => {
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
      setCountedItems(prev => {
        const next = { ...prev };
        delete next[id];
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

  const submitStockTake = async () => {
    setIsSubmitting(true);
    try {
      const promises: Promise<any>[] = [];

      for (const item of filteredInventory) {
        const count = countedItems[item.id];
        if (count === undefined) continue;
        const variance = count - item.stock;
        if (variance !== 0) {
          promises.push(
            apiRequest("POST", "/api/transactions", {
              date: new Date().toISOString(),
              partId: item.id,
              partName: item.name,
              type: reasons[item.id] || (variance > 0 ? "Stock In" : "Stock Out - Missing"),
              quantity: variance,
              userId: "System",
              reference: "Cycle Check",
            })
          );
          promises.push(
            apiRequest("PATCH", `/api/inventory/${item.id}`, {
              stock: count,
            })
          );
        }
      }

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });

      toast({
        title: "Cycle Check Completed",
        description: `Successfully updated stock counts. Date stamps and reasons have been logged.`,
      });

      setTimeout(() => {
        setStep(1);
        setSelectedLocations([]);
        setCountedItems({});
        setReasons({});
      }, 1500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit stock take. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (inventoryLoading) {
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
              <Button onClick={submitStockTake} className="gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isSubmitting ? "Submitting..." : "Complete Cycle Check"}
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
                Select Store Rooms
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
                    Select All Store Rooms
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
                            {inventory.filter((i: any) => areaOf(i) === loc).length} items
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
                  Counting {filteredInventory.length} items across {selectedLocations.length} store room(s).
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
                  <TableHead>Bin</TableHead>
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
                      No items found for the selected store rooms.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item: any) => {
                    const count = countedItems[item.id] !== undefined ? countedItems[item.id] : '';
                    const numCount = typeof count === 'number' ? count : 0;
                    const variance = numCount - item.stock;
                    const hasVariance = variance !== 0 && typeof count === 'number';
                    
                    return (
                      <TableRow key={item.id} className={cn(hasVariance && "bg-orange-50/50 dark:bg-orange-950/20")}>
                        <TableCell className="font-mono text-xs px-4">{item.id}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.binId ?? areaOf(item)}</Badge>
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
