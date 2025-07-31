"use client"

import AdminSidebar, { AdminSidebarProvider, useSidebar } from "@/components/admin/admin-sidebar"
import AdminHeader from "@/components/admin/admin-header"
import { LanguageProvider } from "@/components/language-provider"
import { QueryProvider } from "@/components/query-provider"
import { Toaster } from "sonner"

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMinimized } = useSidebar()

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminSidebar />
      {/* Main content */}
      <div className={`transition-all duration-300 ${isMinimized ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <div className="flex flex-col">
          <AdminHeader />
          <main className="flex-1">
            <div className="py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <QueryProvider>
        <AdminSidebarProvider>
          <AdminLayoutContent>
            {children}
          </AdminLayoutContent>
        </AdminSidebarProvider>
        <Toaster richColors position="top-right" />
      </QueryProvider>
    </LanguageProvider>
  )
}