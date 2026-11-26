import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useJobs, useAssets, useDashboardSummary } from "@/hooks/use-data";
import { useMemo } from "react";
import { BRAND_NAVY, BRAND_AMBER, LogoFull } from "@/components/Logo";
import { usePrinting } from "@/hooks/use-printing";
import { useCurrentUser } from "@/hooks/use-auth";
import type { ReactElement } from "react";
import { EngineeringKpis } from "@/components/EngineeringKpis";

/** Paper size for each chart when printing: half an A4 landscape page. */
const PRINT_W = 470;
const PRINT_H = 250;

/** Responsive on screen; a fixed size on paper, so print and Save as PDF lay out correctly. */
function ChartBox({ printing, children }: { printing: boolean; children: ReactElement }) {
  if (printing) return <div style={{ width: PRINT_W, height: PRINT_H }}>{children}</div>;
  return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
}

const COLORS = [BRAND_NAVY, BRAND_AMBER, "#0EA5E9", "#10B981", "#8B5CF6", "#64748B"];

type Summary = {
  stockValueByCategory: { category: string; value: number; uncosted: number }[];
  topBreakdownAssets: { assetId: string; name: string; breakdowns: number }[];
};

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-6">{text}</div>;
}

export default function Reports() {
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: summaryData, isLoading: summaryLoading } = useDashboardSummary();
  const summary = summaryData as Summary | undefined;
  const printing = usePrinting();
  const { data: me } = useCurrentUser();

  const jobList = (jobs as any[]) || [];
  const assetList = (assets as any[]) || [];
  const isLoading = jobsLoading || assetsLoading || summaryLoading;

  const jobStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    jobList.forEach((job: any) => { counts[job.status || "Unknown"] = (counts[job.status || "Unknown"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [jobList]);

  const assetStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    assetList.forEach((asset: any) => { counts[asset.status || "Unknown"] = (counts[asset.status || "Unknown"] || 0) + 1; });
    return Object.entries(counts).map(([name, assets]) => ({ name, assets }));
  }, [assetList]);

  const stockValue = summary?.stockValueByCategory ?? [];
  const totalStockValue = stockValue.reduce((sum, c) => sum + c.value, 0);
  const uncosted = stockValue.reduce((sum, c) => sum + c.uncosted, 0);
  const topAssets = (summary?.topBreakdownAssets ?? []).map((a) => ({ ...a, label: `${a.name} (${a.assetId})` }));

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="hidden print:flex items-center justify-between border-b pb-3 mb-4">
        <LogoFull className="text-2xl" />
        <div className="text-right text-sm">
          <div className="font-semibold">{me?.companyName ?? ""} · Maintenance report</div>
          <div className="text-muted-foreground">{new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}</div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Maintenance analytics from your live data.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2 print:gap-4">
        <Card className="print-avoid-break print:shadow-none">
          <CardHeader>
            <CardTitle>Job Status</CardTitle>
            <CardDescription>All jobs by current status</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] print:h-auto">
            {jobStatusData.length > 0 ? (
              <ChartBox printing={printing}>
                <PieChart {...(printing ? { width: PRINT_W, height: PRINT_H } : {})}>
                  <Pie
                    data={jobStatusData}
                    cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {jobStatusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartBox>
            ) : <Empty text="No jobs yet" />}
          </CardContent>
        </Card>

        <Card className="print-avoid-break print:shadow-none">
          <CardHeader>
            <CardTitle>Assets by Status</CardTitle>
            <CardDescription>Number of assets in each status</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] print:h-auto">
            {assetStatusData.length > 0 ? (
              <ChartBox printing={printing}>
                <BarChart data={assetStatusData} {...(printing ? { width: PRINT_W, height: PRINT_H } : {})}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="assets" name="Assets" fill={BRAND_NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            ) : <Empty text="No assets yet" />}
          </CardContent>
        </Card>

        <Card className="print-avoid-break print:shadow-none">
          <CardHeader>
            <CardTitle>Stock Value by Category</CardTitle>
            <CardDescription>
              Stock × unit cost · total {gbp(totalStockValue)}
              {uncosted > 0 && <> · {uncosted} part{uncosted === 1 ? "" : "s"} with no cost</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] print:h-auto">
            {stockValue.some((c) => c.value > 0) ? (
              <ChartBox printing={printing}>
                <BarChart data={stockValue} {...(printing ? { width: PRINT_W, height: PRINT_H } : {})}>
                  <XAxis dataKey="category" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => gbp(Number(v))} width={70} />
                  <Tooltip formatter={(v) => gbp(Number(v))} />
                  <Bar dataKey="value" name="Stock value" fill={BRAND_AMBER} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            ) : <Empty text="Add unit costs to parts to see stock value." />}
          </CardContent>
        </Card>

        <Card className="print-avoid-break print:shadow-none">
          <CardHeader>
            <CardTitle>Top 10 Assets by Breakdowns</CardTitle>
            <CardDescription>Breakdown jobs raised in the last 12 months</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] print:h-auto">
            {topAssets.length > 0 ? (
              <ChartBox printing={printing}>
                <BarChart data={topAssets} layout="vertical" margin={{ left: 10 }} {...(printing ? { width: PRINT_W, height: PRINT_H } : {})}>
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="label" width={170} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="breakdowns" name="Breakdowns" fill="#DC2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartBox>
            ) : <Empty text="No breakdown jobs in the last 12 months." />}
          </CardContent>
        </Card>
      </div>

      <EngineeringKpis />
    </Layout>
  );
}
