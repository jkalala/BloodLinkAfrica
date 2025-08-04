"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Droplet, Building, Award, BarChart, Settings, LogOut } from "lucide-react"
import { useEnhancedAuth } from "@/contexts/enhanced-auth-context"
import { useState } from "react"
import { useTranslation } from "@/lib/i18n/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AdminSidebar() {
  const pathname = usePathname()
  const { signOut } = useEnhancedAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const menuItems = [
    {
      title: t("admin.dashboard"),
      href: "/admin",
      icon: BarChart,
    },
    {
      title: t("admin.users"),
      href: "/admin/users",
      icon: Users,
    },
    {
      title: t("admin.bloodRequests"),
      href: "/admin/blood-requests",
      icon: Droplet,
    },
    {
      title: t("admin.bloodBanks"),
      href: "/admin/blood-banks",
      icon: Building,
    },
    {
      title: t("admin.rewards"),
      href: "/admin/rewards",
      icon: Award,
    },
    {
      title: t("admin.settings"),
      href: "/admin/settings",
      icon: Settings,
    },
  ]

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Droplet className="h-6 w-6 text-red-600 mr-2" />
            <span className="font-bold text-lg">BloodLink</span>
          </div>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip={t("admin.logout")}>
                <LogOut className="h-5 w-5" />
                <span>{t("admin.logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}
