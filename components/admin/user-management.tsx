"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Search, Check, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/client"

interface User {
  id: string
  name: string
  phone: string
  blood_type: string
  location: string
  phone_verified: boolean
  role: string
  created_at: string
}

export function UserManagement({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const { t } = useTranslation()

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.blood_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.location.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("admin.searchUsers")}
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-3 px-2 text-left font-medium">{t("admin.name")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.phone")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.bloodType")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.location")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.verified")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.role")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.joined")}</th>
              <th className="py-3 px-2 text-left font-medium">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-3 px-2">{user.name}</td>
                <td className="py-3 px-2">{user.phone}</td>
                <td className="py-3 px-2">{user.blood_type}</td>
                <td className="py-3 px-2">{user.location}</td>
                <td className="py-3 px-2">
                  {user.phone_verified ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </td>
                <td className="py-3 px-2">
                  <Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
                </td>
                <td className="py-3 px-2">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("admin.openMenu")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t("admin.actions")}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>{t("admin.viewDetails")}</DropdownMenuItem>
                      <DropdownMenuItem>{t("admin.editUser")}</DropdownMenuItem>
                      <DropdownMenuItem>{t("admin.verifyPhone")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">{t("admin.deleteUser")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 px-2 text-center text-muted-foreground">
                  {searchTerm ? t("admin.noUsersFound") : t("admin.noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
