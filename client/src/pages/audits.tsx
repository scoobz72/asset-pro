import Layout from "@/components/Layout";
import { assetAudits, assets } from "@/lib/mockData";
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
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  QrCode,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ScanLine
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Audits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);

  const filteredAudits = assetAudits.filter(audit => 
    audit.assetId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    audit.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200"><Clock className="mr-1 size-3" /> Pending</Badge>;
      case "Scheduled":
        return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200"><Calendar className="mr-1 size-3" /> Scheduled</Badge>;
      case "Completed":
        return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200"><CheckCircle2 className="mr-1 size-3" /> Verified</Badge>;
      case "Discrepancy":
        return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200"><AlertTriangle className="mr-1 size-3" /> Discrepancy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper Calendar icon
  const Calendar = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Audits</h1>
          <p className="text-muted-foreground mt-1">Schedule and conduct physical checks to maintain an accurate asset map.</p>
        </div>
        <div className="flex gap-2">
          {/* Mobile QR Scanner Simulation */}
          <Dialog open={isMobileScannerOpen} onOpenChange={setIsMobileScannerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                <QrCode className="mr-2 size-4" />
                Mobile Scanner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ScanLine className="size-5" /> Scan Asset Tag</DialogTitle>
                <DialogDescription>
                  Point your device camera at the asset's QR code or barcode to instantly pull up its record and log its location.
                </DialogDescription>
              </DialogHeader>
              <div className="aspect-square bg-black rounded-md overflow-hidden relative flex items-center justify-center border-4 border-muted">
                {/* Simulated Camera Viewfinder */}
                <div className="absolute inset-8 border-2 border-green-500/50 rounded-lg">
                  <div className="absolute -top-1 -left-1 size-4 border-t-4 border-l-4 border-green-500" />
                  <div className="absolute -top-1 -right-1 size-4 border-t-4 border-r-4 border-green-500" />
                  <div className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-green-500" />
                  <div className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-green-500" />
                </div>
                <div className="h-1 w-full bg-green-500/80 absolute top-1/2 -translate-y-1/2 shadow-[0_0_8px_2px_rgba(34,197,94,0.5)] animate-pulse" />
                <p className="text-white/50 text-sm z-10 mt-32 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Align code within frame</p>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="ghost" onClick={() => setIsMobileScannerOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  setIsMobileScannerOpen(false);
                  // In a real app, this would trigger the audit flow for the scanned asset
                  setTimeout(() => alert("Simulated scan successful for Asset A-101"), 300);
                }}>Simulate Scan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                Schedule Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Schedule Area Audit</DialogTitle>
                <DialogDescription>
                  Create a bulk audit task for a specific location or production line to verify all assets within it.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="auditType">Audit Scope</Label>
                  <Select defaultValue="location">
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">By Location (Building/Area)</SelectItem>
                      <SelectItem value="line">By Production Line</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Target Area</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select area to audit..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="b-a">Building A</SelectItem>
                      <SelectItem value="b-b">Building B</SelectItem>
                      <SelectItem value="roof">Roof</SelectItem>
                      <SelectItem value="base">Basement</SelectItem>
                      <SelectItem value="work">Workshop</SelectItem>
                      <SelectItem value="line-1">Line 1 (Packaging)</SelectItem>
                      <SelectItem value="line-2">Line 2 (Assembly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assignee">Assign Auditor</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">John Doe</SelectItem>
                      <SelectItem value="2">Sarah Smith</SelectItem>
                      <SelectItem value="3">Mike Johnson</SelectItem>
                      <SelectItem value="4">Emily Davis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Scheduled Date</Label>
                  <Input type="date" id="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Schedule Bulk Audit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search by asset ID or assignee..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9" 
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Audit ID</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Expected Location</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAudits.map((audit) => {
              const asset = assets.find(a => a.id === audit.assetId);
              
              return (
                <TableRow key={audit.id}>
                  <TableCell className="font-medium font-mono text-xs text-muted-foreground">
                    {audit.id}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{asset?.name || "Unknown Asset"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{audit.assetId}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {audit.scheduledDate}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <MapPin className="mr-1.5 size-3.5 text-muted-foreground" />
                      {audit.expectedLocation}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {audit.assignedTo}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(audit.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(audit.status === "Pending" || audit.status === "Scheduled") && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="mr-2 border-primary/50 hover:bg-primary/5">
                            Conduct
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Conduct Asset Audit</DialogTitle>
                            <DialogDescription>
                              Verify the physical location of {asset?.name} ({audit.assetId}).
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="p-3 bg-muted/40 border rounded-md text-sm">
                              <span className="font-medium text-muted-foreground">Expected Location:</span> {audit.expectedLocation}
                            </div>
                            
                            <div className="space-y-3">
                              <Label>Is the asset in its expected location?</Label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-muted/50 [&:has(:checked)]:border-green-500 [&:has(:checked)]:bg-green-500/5">
                                  <input type="radio" name="locationCheck" className="accent-green-600" defaultChecked />
                                  <div className="font-medium text-sm">Yes, Verified</div>
                                </label>
                                <label className="flex items-center gap-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-muted/50 [&:has(:checked)]:border-red-500 [&:has(:checked)]:bg-red-500/5">
                                  <input type="radio" name="locationCheck" className="accent-red-600" />
                                  <div className="font-medium text-sm">No, Moved</div>
                                </label>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="newLocation">Update Location (If Moved)</Label>
                              <Select>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select current physical location..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Building A">Building A</SelectItem>
                                  <SelectItem value="Building B">Building B</SelectItem>
                                  <SelectItem value="Roof">Roof</SelectItem>
                                  <SelectItem value="Basement">Basement</SelectItem>
                                  <SelectItem value="Workshop">Workshop</SelectItem>
                                  <SelectItem value="Storage">Storage</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="grid gap-2">
                              <Label htmlFor="notes">Audit Notes</Label>
                              <Textarea id="notes" placeholder="Any issues found or reason for move..." />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">Submit Audit</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {audit.status === "Discrepancy" && (
                      <Button size="sm" variant="outline" className="mr-2 text-red-600 border-red-200 hover:bg-red-50">
                        Resolve
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Audit Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View Asset History</DropdownMenuItem>
                        <DropdownMenuItem>Reassign Auditor</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Cancel Audit</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAudits.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No audits found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
