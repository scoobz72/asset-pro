import Layout from "@/components/Layout";
import { templates } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileSignature, Plus, Search, FileText, CheckCircle2, MoreHorizontal, PenSquare, Trash2, GripVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function Templates() {
  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Templates</h1>
          <p className="text-muted-foreground mt-1">Manage standardized procedures and breakdown protocols.</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Job Template</DialogTitle>
                <DialogDescription>
                  Define standard steps and required sign-offs for recurring jobs or generic breakdowns.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input id="name" placeholder="e.g., Annual Chiller Maintenance" />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="type">Template Type</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-muted/50 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                      <input type="radio" name="type" className="accent-primary" defaultChecked />
                      <div>
                        <div className="font-medium">Planned Maintenance</div>
                        <div className="text-xs text-muted-foreground">Specific steps for preventative work</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-muted/50 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                      <input type="radio" name="type" className="accent-primary" />
                      <div>
                        <div className="font-medium">Breakdown</div>
                        <div className="text-xs text-muted-foreground">Generic protocol for unexpected failures</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" placeholder="Briefly describe when to use this template..." />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Procedure Steps</Label>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 size-3" /> Add Step
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex items-start gap-2 bg-muted/40 p-2 rounded-md border">
                        <GripVertical className="size-4 text-muted-foreground mt-2 cursor-move" />
                        <span className="mt-2 text-sm font-medium text-muted-foreground">{step}.</span>
                        <div className="flex-1 space-y-2">
                          <Input placeholder="Describe the task..." className="h-8" />
                          <div className="flex items-center gap-2">
                            <Checkbox id={`req-${step}`} defaultChecked />
                            <label htmlFor={`req-${step}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Required for completion
                            </label>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Required Sign-offs</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground">Technician</Badge>
                    <Badge variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground">Lead Engineer</Badge>
                    <Badge variant="default" className="px-3 py-1 text-sm cursor-pointer">Safety Officer</Badge>
                    <Badge variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground">Quality Inspector</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Select roles required to sign off on this job.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button type="submit">Save Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge variant={template.type === "Breakdown" ? "destructive" : "default"} className={cn(
                  template.type === "Breakdown" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"
                )}>
                  {template.type}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mt-2 -mr-2 h-8 w-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><PenSquare className="mr-2 size-4" /> Edit Template</DropdownMenuItem>
                    <DropdownMenuItem><FileText className="mr-2 size-4" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardTitle className="text-xl mt-2 leading-tight">{template.name}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center text-muted-foreground">
                    <CheckCircle2 className="mr-1.5 size-4" /> 
                    Procedure ({template.steps.length} steps)
                  </h4>
                  <ul className="space-y-2">
                    {template.steps.slice(0, 3).map((step, idx) => (
                      <li key={step.id} className="text-sm flex gap-2">
                        <span className="text-muted-foreground font-mono">{idx + 1}.</span>
                        <span className="line-clamp-1 flex-1">{step.text}</span>
                        {step.required && <span className="text-[10px] text-red-500 font-medium bg-red-50 px-1 rounded">Req</span>}
                      </li>
                    ))}
                    {template.steps.length > 3 && (
                      <li className="text-xs text-muted-foreground italic pl-5">
                        + {template.steps.length - 3} more steps
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t pt-4 flex flex-col items-start gap-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required Sign-offs</h4>
              <div className="flex flex-wrap gap-1.5">
                {template.signOffs.map(role => (
                  <Badge key={role} variant="outline" className="bg-background flex items-center gap-1">
                    <FileSignature className="size-3 text-primary" />
                    {role}
                  </Badge>
                ))}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
