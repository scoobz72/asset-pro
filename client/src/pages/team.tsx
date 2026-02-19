import Layout from "@/components/Layout";
import { users } from "@/lib/mockData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone, Mail, MoreVertical } from "lucide-react";

export default function Team() {
  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">Manage personnel and schedules.</p>
        </div>
        <Button>Add Member</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <Card key={user.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription>{user.role}</CardDescription>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant={
                  user.status === "Available" ? "default" : 
                  user.status === "Busy" ? "destructive" : 
                  "secondary"
                } className={
                  user.status === "Available" ? "bg-green-500 hover:bg-green-600" :
                  user.status === "Busy" ? "bg-red-500 hover:bg-red-600" :
                  "bg-slate-500 hover:bg-slate-600"
                }>
                  {user.status}
                </Badge>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="mr-2 h-4 w-4" />
                  {user.name.toLowerCase().replace(" ", ".")}@example.com
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="mr-2 h-4 w-4" />
                  +1 (555) 000-{1000 + user.id}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" variant="outline">View Schedule</Button>
                <Button className="flex-1" variant="outline">Assign Job</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
