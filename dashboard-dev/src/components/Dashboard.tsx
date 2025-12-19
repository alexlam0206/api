import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { fetchDashboardData, type DashboardData, deleteUser, updateGlobalLimits, updateUserLimit, addUser, type UserData } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogOut, Plus, RefreshCw, Users, Activity, Trash2, Edit, Search } from "lucide-react";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editMonthly, setEditMonthly] = useState(0);
  const [editDaily, setEditDaily] = useState(0);
  
  // Global Limits State
  const [globalMonthly, setGlobalMonthly] = useState(0);
  const [globalDaily, setGlobalDaily] = useState(0);

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserMonthly, setNewUserMonthly] = useState(50);
  const [newUserDaily, setNewUserDaily] = useState(10);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
      setGlobalMonthly(dashboardData.systemLimits.monthly);
      setGlobalDaily(dashboardData.systemLimits.daily);
      
      // Set defaults for new user based on global limits
      setNewUserMonthly(dashboardData.systemLimits.monthly);
      setNewUserDaily(dashboardData.systemLimits.daily);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail) {
      setAddUserError("Please enter an email");
      return;
    }
    if (!newUserName) {
      setNewUserName(newUserEmail.split('@')[0]);
    }
    setAddUserError(null);
    setIsAddingUser(true);
    try {
      await addUser(newUserEmail, newUserMonthly, newUserDaily, newUserName || undefined);
      setIsAddUserOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add user";
      setAddUserError(message);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
      await deleteUser(email);
      await loadData();
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  const handleUpdateGlobal = async () => {
    try {
      await updateGlobalLimits(globalMonthly, globalDaily);
      alert("Global limits updated successfully");
      await loadData();
    } catch (error) {
      alert("Failed to update global limits");
    }
  };

  const openEditUser = (user: UserData) => {
    setEditingUser(user);
    setEditMonthly(user.monthlyLimit);
    setEditDaily(user.dailyLimit);
  };

  const handleSaveUserLimit = async () => {
    if (!editingUser) return;
    try {
      await updateUserLimit(editingUser.email, editMonthly, editDaily);
      setEditingUser(null);
      await loadData();
    } catch (error) {
      alert("Failed to update user limits");
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

  const filteredUsers = data.userList.filter(user => 
    (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.id?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Usage Dashboard</h1>
            <p className="text-muted-foreground">Manage user limits and monitor AI generation usage</p>
          </div>
          <div className="flex gap-2 sm:justify-end">
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
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-8 w-full sm:w-[250px]" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Monthly Usage</TableHead>
                        <TableHead>Daily Usage</TableHead>
                        <TableHead>Limits (M/D)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell className="font-mono text-xs">{user.id}</TableCell>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.name || "-"}</TableCell>
                          <TableCell>{user.monthlyUsage} / {user.monthlyLimit}</TableCell>
                          <TableCell>{user.dailyUsage} / {user.dailyLimit}</TableCell>
                          <TableCell>{user.monthlyLimit} / {user.dailyLimit}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteUser(user.email)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                    <Input 
                      id="globalMonthly" 
                      type="number" 
                      value={globalMonthly} 
                      onChange={(e) => setGlobalMonthly(Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="globalDaily">Global Daily Limit</Label>
                    <Input 
                      id="globalDaily" 
                      type="number" 
                      value={globalDaily} 
                      onChange={(e) => setGlobalDaily(Number(e.target.value))} 
                    />
                  </div>
                </div>
                <Button onClick={handleUpdateGlobal}>Update Limits</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Limits</DialogTitle>
            <DialogDescription>
              Set specific limits for {editingUser?.email}. These override global limits.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editMonthly" className="text-right">Monthly</Label>
              <Input 
                id="editMonthly" 
                type="number" 
                value={editMonthly} 
                onChange={(e) => setEditMonthly(Number(e.target.value))}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editDaily" className="text-right">Daily</Label>
              <Input 
                id="editDaily" 
                type="number" 
                value={editDaily} 
                onChange={(e) => setEditDaily(Number(e.target.value))}
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveUserLimit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user manually. They will be able to access the API immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {addUserError && (
              <Alert variant="destructive">
                <AlertDescription>{addUserError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="newEmail" className="sm:text-right">Email</Label>
              <Input 
                id="newEmail" 
                type="email" 
                placeholder="user@example.com"
                value={newUserEmail} 
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="sm:col-span-3" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="newName" className="sm:text-right">Name</Label>
              <Input 
                id="newName" 
                type="text" 
                placeholder="User Name"
                value={newUserName} 
                onChange={(e) => setNewUserName(e.target.value)}
                className="sm:col-span-3" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="newMonthly" className="sm:text-right">Monthly</Label>
              <Input 
                id="newMonthly" 
                type="number" 
                value={newUserMonthly} 
                onChange={(e) => setNewUserMonthly(Number(e.target.value))}
                className="sm:col-span-3" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="newDaily" className="sm:text-right">Daily</Label>
              <Input 
                id="newDaily" 
                type="number" 
                value={newUserDaily} 
                onChange={(e) => setNewUserDaily(Number(e.target.value))}
                className="sm:col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddUser} disabled={isAddingUser}>
              {isAddingUser ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
