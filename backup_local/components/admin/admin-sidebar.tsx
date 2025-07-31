"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Database,
  LayoutDashboard,
  FileText,
  Settings,
  Activity,
  Shield,
  Brain,
  Car,
  Radio,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

const navigationItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    description: "Scraping controls and overview",
  },
  {
    title: "Article Review",
    url: "/admin/articles",
    icon: FileText,
    description: "Review scraped articles and content",
  },
  {
    title: "Car Listings",
    url: "/admin/cars",
    icon: Car,
    description: "Manage car listings and 28car scraper",
  },
  {
    title: "Government Signals",
    url: "/admin/signals",
    icon: Radio,
    description: "Monitor government incident feeds and AI enrichment",
  },
  {
    title: "Database",
    url: "/admin/database",
    icon: Database,
    description: "Database management and setup",
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    description: "Admin preferences and configuration",
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Admin Panel</span>
                  <span className="truncate text-xs">Panora.hk</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const isActive = pathname === item.url || 
              (item.url !== "/admin" && pathname.startsWith(item.url))
            
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive}
                  tooltip={item.description}
                >
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <div className="flex items-center gap-2 p-2">
                <Activity className="size-4 text-green-500" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">System Status</div>
                  <Badge variant="secondary" className="text-xs">
                    Online
                  </Badge>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}