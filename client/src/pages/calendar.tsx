import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useJobs } from "@/hooks/use-data";
import { isSameDay, format } from "date-fns";

export default function WorkCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data: jobs, isLoading } = useJobs();
  const jobList = (jobs as any[] || []);

  const selectedJobs = jobList.filter((job: any) => date && job.dueDate && isSameDay(new Date(job.dueDate), date));

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground mt-1">Plan and view maintenance activities.</p>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-8 mt-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border shadow-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {date ? format(date, "EEEE, MMMM do, yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedJobs.length > 0 ? (
              <div className="space-y-4">
                {selectedJobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-12 rounded-full bg-primary" />
                      <div>
                        <h4 className="font-semibold">{job.title}</h4>
                        <p className="text-sm text-muted-foreground">{job.id} • {job.assetId}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No jobs scheduled for this day.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
