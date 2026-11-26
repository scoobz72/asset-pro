import Layout from "@/components/Layout";
import { useState } from "react";
import { useJobs, useUsers, useAssets, useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-data";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
import { format } from "date-fns";
import { 
  Filter, 
  MoreHorizontal, 
  Plus, 
  Search, 
  ArrowUpDown,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Jobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newAssetId, setNewAssetId] = useState("");
  const [newType, setNewType] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editAssetId, setEditAssetId] = useState("");
  const [editType, setEditType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const { toast } = useToast();

  const { data: jobsData, isLoading: jobsLoading } = useJobs();
  const { data: usersData } = useUsers();
  const { data: assetsData } = useAssets();

  const jobsList: any[] = (jobsData as any[]) || [];
  const usersList: any[] = (usersData as any[]) || [];
  const assetsList: any[] = (assetsData as any[]) || [];

  const createJob = useCreateMutation("/api/jobs", ["/api/jobs"]);
  const updateJob = useUpdateMutation("/api/jobs", ["/api/jobs"]);
  const deleteJob = useDeleteMutation("/api/jobs", ["/api/jobs"]);

  const filteredJobs = jobsList.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? job.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    createJob.mutate({
      title: newTitle,
      assetId: newAssetId || null,
      type: newType || "Breakdown",
      priority: newPriority || "Medium",
      status: "Open",
      assigneeId: newAssigneeId ? parseInt(newAssigneeId) : null,
      dueDate: new Date().toISOString(),
    }, {
      onSuccess: (job: any) => {
        toast({ title: "Job created", description: `${job?.id ?? "Job"} created successfully` });
        setCreateOpen(false);
        setNewTitle("");
        setNewAssetId("");
        setNewType("");
        setNewPriority("");
        setNewAssigneeId("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleEdit = () => {
    if (!editingJob) return;
    updateJob.mutate({
      id: editingJob.id,
      data: {
        title: editTitle,
        assetId: editAssetId || null,
        type: editType || "Breakdown",
        priority: editPriority || "Medium",
        status: editStatus || "Open",
        assigneeId: editAssigneeId ? parseInt(editAssigneeId) : null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Job updated", description: `${editingJob.id} updated successfully` });
        setEditOpen(false);
        setEditingJob(null);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const openEditDialog = (job: any) => {
    setEditingJob(job);
    setEditTitle(job.title);
    setEditAssetId(job.assetId || "");
    setEditType(job.type || "Breakdown");
    setEditPriority(job.priority || "Medium");
    setEditAssigneeId(job.assigneeId ? String(job.assigneeId) : "");
    setEditStatus(job.status);
    setEditOpen(true);
  };

  const handleMarkComplete = (job: any) => {
    updateJob.mutate({
      id: job.id,
      data: { status: "Completed" }
    }, {
      onSuccess: () => {
        toast({ title: "Job completed", description: `${job.id} marked as completed` });
      }
    });
  };

  const handleDelete = (job: any) => {
    deleteJob.mutate(job.id, {
      onSuccess: () => {
        toast({ title: "Job deleted", description: `${job.id} deleted` });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const getAssetName = (assetId: string | null) => {
    if (!assetId) return <span className="text-muted-foreground italic">None</span>;
    const asset = assetsList.find(a => a.id === assetId);
    return asset?.name || assetId;
  };

  const getAssigneeName = (assigneeId: number | null) => {
    if (!assigneeId) return <span className="text-muted-foreground italic">Unassigned</span>;
    const user = usersList.find(u => u.id === assigneeId);
    return user?.name || `User #${assigneeId}`;
  };

  if (jobsLoading) {
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage maintenance tasks and work orders.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-job">
                <Plus className="mr-2 size-4" />
                Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Job</DialogTitle>
                <DialogDescription>
                  Create a new maintenance ticket. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="Fix hydraulic leak" 
                    className="col-span-3"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    data-testid="input-job-title"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="asset" className="text-right">Asset</Label>
                  <Select value={newAssetId} onValueChange={setNewAssetId}>
                    <SelectTrigger className="col-span-3" data-testid="select-job-asset">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetsList.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="jobType" className="text-right">Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="col-span-3" data-testid="select-job-type">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Breakdown">Breakdown</SelectItem>
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="Request">Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className="text-right">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="col-span-3" data-testid="select-job-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="assignee" className="text-right">Assignee</Label>
                  <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                    <SelectTrigger className="col-span-3" data-testid="select-job-assignee">
                      <SelectValue placeholder="Assign technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {usersList.filter(u => u.role === "Technician").map(user => (
                        <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createJob.isPending} data-testid="button-save-job">
                  {createJob.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Filter jobs..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-jobs"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto" data-testid="button-filter-status">
              <Filter className="mr-2 size-4" />
              Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={statusFilter === null} onCheckedChange={() => setStatusFilter(null)}>
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={statusFilter === "Open"} onCheckedChange={() => setStatusFilter("Open")}>
              Open
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={statusFilter === "In Progress"} onCheckedChange={() => setStatusFilter("In Progress")}>
              In Progress
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={statusFilter === "Completed"} onCheckedChange={() => setStatusFilter("Completed")}>
              Completed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center" data-testid="text-no-jobs">
                  No jobs found.
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                  <TableCell className="font-medium font-mono text-xs text-muted-foreground">
                    {job.id}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-job-title-${job.id}`}>{job.title}</TableCell>
                  <TableCell data-testid={`text-job-asset-${job.id}`}>{getAssetName(job.assetId)}</TableCell>
                  <TableCell data-testid={`text-job-assignee-${job.id}`}>
                    {getAssigneeName(job.assigneeId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      job.priority === "Critical" ? "border-red-500 text-red-500 bg-red-500/10" :
                      job.priority === "High" ? "border-orange-500 text-orange-500 bg-orange-500/10" :
                      job.priority === "Medium" ? "border-blue-500 text-blue-500 bg-blue-500/10" :
                      "border-slate-500 text-slate-500"
                    )} data-testid={`badge-priority-${job.id}`}>
                      {job.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" data-testid={`status-job-${job.id}`}>
                      <div className={cn(
                        "size-2 rounded-full",
                        job.status === "Open" ? "bg-slate-400" :
                        job.status === "In Progress" ? "bg-blue-500 animate-pulse" :
                        job.status === "Completed" ? "bg-green-500" :
                        "bg-yellow-500"
                      )} />
                      {job.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {job.dueDate ? format(new Date(job.dueDate), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${job.id}`}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openEditDialog(job)} data-testid={`action-edit-${job.id}`}>
                          Edit job
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleMarkComplete(job)} data-testid={`action-complete-${job.id}`}>
                          Mark as Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(job)} data-testid={`action-delete-${job.id}`}>
                          Delete job
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Job {editingJob?.id}</DialogTitle>
            <DialogDescription>
              Update job details. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">Title</Label>
              <Input 
                id="edit-title" 
                className="col-span-3"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="input-edit-job-title"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-asset" className="text-right">Asset</Label>
              <Select value={editAssetId} onValueChange={setEditAssetId}>
                <SelectTrigger className="col-span-3" data-testid="select-edit-job-asset">
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetsList.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="col-span-3" data-testid="select-edit-job-type">
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Breakdown">Breakdown</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Request">Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-priority" className="text-right">Priority</Label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger className="col-span-3" data-testid="select-edit-job-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="col-span-3" data-testid="select-edit-job-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-assignee" className="text-right">Assignee</Label>
              <Select value={editAssigneeId} onValueChange={setEditAssigneeId}>
                <SelectTrigger className="col-span-3" data-testid="select-edit-job-assignee">
                  <SelectValue placeholder="Assign technician" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.filter(u => u.role === "Technician").map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateJob.isPending} data-testid="button-save-edit-job">
              {updateJob.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
