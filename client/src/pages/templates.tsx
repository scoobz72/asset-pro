import Layout from "@/components/Layout";
import { templates } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileSignature, Plus, Search, FileText, CheckCircle2, MoreHorizontal, PenSquare, Trash2, GripVertical, UploadCloud, Sparkles, Loader2, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Templates() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedSteps, setGeneratedSteps] = useState([
    { id: 1, text: "Describe the task...", required: true },
    { id: 2, text: "Describe the task...", required: true },
    { id: 3, text: "Describe the task...", required: true },
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleAIGeneration = () => {
    if (!uploadedFile) return;
    setIsGenerating(true);
    // Simulate AI processing time
    setTimeout(() => {
      setGeneratedSteps([
        { id: 1, text: "Lockout/Tagout main power supply", required: true },
        { id: 2, text: "Remove primary housing cover bolts (12mm)", required: true },
        { id: 3, text: "Inspect drive belt for fraying or cracking", required: true },
        { id: 4, text: "Lubricate main bearing assembly with lithium grease", required: true },
        { id: 5, text: "Check calibration of pressure sensors", required: false },
        { id: 6, text: "Reinstall housing and verify operational status", required: true },
      ]);
      setIsGenerating(false);
    }, 2500);
  };
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
                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" className="h-7 text-xs bg-primary/5 text-primary border-primary/20 hover:bg-primary/10">
                         <Sparkles className="mr-1 size-3" /> Auto-Generate (AI)
                       </Button>
                       <Button variant="outline" size="sm" className="h-7 text-xs">
                         <Plus className="mr-1 size-3" /> Add Step
                       </Button>
                    </div>
                  </div>

                  {/* AI Upload Section Simulation */}
                  <div className="border-2 border-dashed rounded-lg p-6 bg-muted/20 text-center flex flex-col items-center justify-center transition-colors hover:bg-muted/40 relative overflow-hidden">
                    {isGenerating ? (
                      <div className="flex flex-col items-center text-primary py-4">
                         <Loader2 className="size-8 animate-spin mb-2" />
                         <p className="text-sm font-medium">Extracting maintenance steps with AI...</p>
                         <p className="text-xs text-muted-foreground mt-1 text-center max-w-[250px]">Analyzing document structure and identifying required procedures and sign-offs.</p>
                      </div>
                    ) : uploadedFile ? (
                      <div className="flex flex-col items-center py-2">
                        <div className="size-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                          <FileDown className="size-6" />
                        </div>
                        <p className="text-sm font-medium">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Ready for AI extraction</p>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => setUploadedFile(null)}>Remove</Button>
                          <Button size="sm" onClick={handleAIGeneration} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Sparkles className="mr-2 size-3" /> Extract Steps
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="size-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-3">
                          <UploadCloud className="size-6" />
                        </div>
                        <h4 className="text-sm font-medium mb-1">Upload Asset Document</h4>
                        <p className="text-xs text-muted-foreground max-w-[300px] mb-4">
                          Upload a PDF, Word, or text manual. Our AI will automatically extract the planned maintenance steps for you to review.
                        </p>
                        <Label htmlFor="doc-upload" className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium">
                          Browse Files
                        </Label>
                        <Input 
                          id="doc-upload" 
                          type="file" 
                          accept=".pdf,.doc,.docx,.txt" 
                          className="hidden" 
                          onChange={handleFileUpload}
                        />
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    {generatedSteps.map((step) => (
                      <div key={step.id} className="flex items-start gap-2 bg-muted/40 p-2 rounded-md border">
                        <GripVertical className="size-4 text-muted-foreground mt-2 cursor-move" />
                        <span className="mt-2 text-sm font-medium text-muted-foreground">{step.id}.</span>
                        <div className="flex-1 space-y-2">
                          <Input 
                            value={step.text} 
                            onChange={(e) => {
                              const newSteps = [...generatedSteps];
                              const idx = newSteps.findIndex(s => s.id === step.id);
                              newSteps[idx].text = e.target.value;
                              setGeneratedSteps(newSteps);
                            }}
                            className="h-8" 
                          />
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`req-${step.id}`} 
                              checked={step.required}
                              onCheckedChange={(checked) => {
                                const newSteps = [...generatedSteps];
                                const idx = newSteps.findIndex(s => s.id === step.id);
                                newSteps[idx].required = checked === true;
                                setGeneratedSteps(newSteps);
                              }}
                            />
                            <label htmlFor={`req-${step.id}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Required for completion
                            </label>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setGeneratedSteps(generatedSteps.filter(s => s.id !== step.id).map((s, i) => ({...s, id: i + 1})));
                          }}
                        >
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
