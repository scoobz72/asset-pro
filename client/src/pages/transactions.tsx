import Layout from "@/components/Layout";
import { stockTransactions } from "@/lib/mockData";
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
  Search, 
  Download,
  Filter,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = stockTransactions.filter(txn => 
    txn.partName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    txn.partId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    txn.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "Job Book Out":
      case "Stock Out - Missing":
      case "Stock Out - Damaged":
        return <ArrowUpFromLine className="size-4 text-orange-500" />;
      case "Purchase Order":
      case "Transfer In":
      case "Stock In":
        return <ArrowDownToLine className="size-4 text-green-500" />;
      case "Stock Adjustment":
        return <RefreshCw className="size-4 text-blue-500" />;
      default:
        return <ArrowRightLeft className="size-4 text-slate-500" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "Job Book Out":
        return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Job Book Out</Badge>;
      case "Stock Out - Missing":
        return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Missing</Badge>;
      case "Stock Out - Damaged":
        return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Damaged</Badge>;
      case "Purchase Order":
        return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Purchase Order</Badge>;
      case "Stock In":
        return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Stock In</Badge>;
      case "Transfer In":
        return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Transfer In</Badge>;
      case "Stock Adjustment":
        return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Adjustment</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Transactions</h1>
          <p className="text-muted-foreground mt-1">Audit log of all inventory movements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search by part, reference..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9" 
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 size-4" />
              Filter Type
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Transaction Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>All Transactions</DropdownMenuItem>
            <DropdownMenuItem>Job Book Out</DropdownMenuItem>
            <DropdownMenuItem>Purchase Orders</DropdownMenuItem>
            <DropdownMenuItem>Adjustments</DropdownMenuItem>
            <DropdownMenuItem>Transfers</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Time</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="text-sm font-medium">{format(new Date(txn.date), "MMM d, yyyy")}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(txn.date), "h:mm a")}</div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {txn.id}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{txn.partName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{txn.partId}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(txn.type)}
                    {getTransactionBadge(txn.type)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "font-bold font-mono",
                    txn.quantity > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {txn.quantity > 0 ? "+" : ""}{txn.quantity}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {txn.reference}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {txn.user}
                </TableCell>
              </TableRow>
            ))}
            {filteredTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
