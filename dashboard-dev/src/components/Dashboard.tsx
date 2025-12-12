import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { fetchDashboardData, type DashboardData } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Plus, RefreshCw, Users, Activity } from "lucide-react";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSignOut = () => {
    auth.signOut();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen">Error loading data</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Usage Dashboard</h1>
            <p className="text-muted-foreground">Manage user limits and monitor AI generation usage</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Users" value={data.users} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
          <StatsCard title="Active Today" value={data.activeToday} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
          <StatsCard title="Total Requests" value={data.totalRequests} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
          <StatsCard title="Avg Tokens/Req" value={data.avgTokens} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage user access and limits</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Monthly Usage</TableHead>
                        <TableHead>Daily Usage</TableHead>
                        <TableHead>Limits (M/D)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.userList.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.monthlyUsage} / {user.monthlyLimit}</TableCell>
                          <TableCell>{user.dailyUsage} / {user.dailyLimit}</TableCell>
                          <TableCell>{user.monthlyLimit} / {user.dailyLimit}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">Edit</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
             <Card>
              <CardHeader>
                <CardTitle>Global Limits</CardTitle>
                <CardDescription>Set system-wide limits for AI usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="globalMonthly">Global Monthly Limit</Label>
                    <Input id="globalMonthly" type="number" defaultValue={data.systemLimits.monthly} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="globalDaily">Global Daily Limit</Label>
                    <Input id="globalDaily" type="number" defaultValue={data.systemLimits.daily} />
                  </div>
                </div>
                <Button>Update Limits</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
