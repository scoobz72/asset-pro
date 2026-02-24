import Layout from "@/components/Layout";
import { useMemo, useState } from "react";
import { useMaintenanceRequests, useAssets } from "@/hooks/use-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ClipboardEdit, Factory, ShieldCheck, Send, Loader2 } from "lucide-react";

export default function RequestPortal() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] = useState("Production User");

  const { data: requests = [], isLoading: requestsLoading } = useMaintenanceRequests();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/maintenance-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-requests"] });
      toast({
        title: "Request submitted",
        description: "Maintenance has been notified for triage.",
      });
      reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reset = () => {
    setTitle("");
    setAssetId(null);
    setArea("");
    setUrgency("Medium");
    setDescription("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const id = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    createRequestMutation.mutate({
      id,
      title,
      assetId: assetId || null,
      area,
      urgency,
      description,
      requestedBy,
      status: "Submitted",
      createdAt: new Date().toISOString(),
    });
  };

  const recent = useMemo(() => (requests as any[]).slice(0, 6), [requests]);

  const urgencyBadge = (u: string) => {
    if (u === "High") return <Badge variant="destructive">High</Badge>;
    if (u === "Medium") return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">Medium</Badge>;
    return <Badge variant="outline" className="bg-muted/20">Low</Badge>;
  };

  const isLoading = requestsLoading || assetsLoading;

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Request Portal</h1>
          <p className="text-muted-foreground mt-1">
            Log maintenance requests in seconds. Maintenance will triage and convert into jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20">
            Request → Job (Type: Request)
          </Badge>
          <Badge variant="outline" className="font-mono">
            Demo Mode
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardEdit className="size-5 text-primary" />
              Submit a Request
            </CardTitle>
            <CardDescription>
              Provide the basics (what, where, how urgent). Add an asset if applicable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="input-requestedby">Requested by</Label>
                <Input
                  data-testid="input-requestedby"
                  id="input-requestedby"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-title">Request title</Label>
                <Input
                  data-testid="input-request-title"
                  id="input-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Pump leaking near coupling"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset (optional)</Label>
                  <Select value={assetId ?? undefined} onValueChange={(v) => setAssetId(v)}>
                    <SelectTrigger data-testid="select-request-asset">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assets as any[]).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="input-area">Area / Line</Label>
                  <Input
                    data-testid="input-request-area"
                    id="input-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g., Line 2"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                  <SelectTrigger data-testid="select-request-urgency">
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="textarea-desc">Description</Label>
                <Textarea
                  data-testid="textarea-request-description"
                  id="textarea-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? When did it start? Any safety concerns?"
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  data-testid="button-submit-request"
                  type="submit"
                  className="gap-2"
                  disabled={createRequestMutation.isPending}
                >
                  {createRequestMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
                <Button
                  data-testid="button-reset-request"
                  type="button"
                  variant="outline"
                  onClick={reset}
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground flex items-start gap-3">
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">What happens next?</p>
                  <p>
                    Maintenance reviews your request and converts it into a Job with type <span className="font-mono">Request</span>.
                    You can track status below.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="size-5 text-primary" /> Recent Requests
            </CardTitle>
            <CardDescription>
              Latest submissions from Production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No requests yet.</div>
            ) : (
              recent.map((r: any) => {
                const assetName = r.assetId ? (assets as any[]).find((a: any) => a.id === r.assetId)?.name : null;
                return (
                  <div
                    key={r.id}
                    data-testid={`card-request-${r.id}`}
                    className="p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        </div>
                        <div className="font-semibold truncate mt-1">{r.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium text-foreground/90">{r.area}</span>
                          {assetName ? <span className="text-muted-foreground"> • {assetName}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Requested by {r.requestedBy}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {urgencyBadge(r.urgency)}
                        <div className="text-[10px] text-muted-foreground">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
