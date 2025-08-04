import { getSupabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserManagement } from "@/components/admin/user-management"

export const dynamic = "force-dynamic"

async function getUsers() {
  const supabase = getSupabase()

  const { data: users, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return users
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage donors and administrators</p>
        </div>
        <Button className="bg-red-700 hover:bg-red-800 text-white">Add User</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all registered users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagement initialUsers={users} />
        </CardContent>
      </Card>
    </div>
  )
}
