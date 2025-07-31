"use client"

import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar"
import AdminSidebar from "@/components/admin/admin-sidebar"
import AdminHeader from "@/components/admin/admin-header"
import { LanguageProvider } from "@/components/language-provider"
import { QueryProvider } from "@/components/query-provider"
import { Toaster } from "sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <QueryProvider>
        <div className="fixed inset-0 flex">
          <SidebarProvider>
            <AdminSidebar />
            <SidebarInset className="overflow-y-auto">
              <AdminHeader />
              <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
        <Toaster richColors position="top-right" />
      </QueryProvider>
    </LanguageProvider>
  )
}