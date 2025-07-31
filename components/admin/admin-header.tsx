"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const pathTitles = {
  "/admin": "Dashboard",
  "/admin/articles": "Articles",
  "/admin/cars": "Cars",
  "/admin/signals": "Signals",
  "/admin/database": "Database",
  "/admin/settings": "Settings",
}

export default function AdminHeader() {
  const pathname = usePathname()
  const title = pathTitles[pathname] || "Admin Panel"
  
  // Generate breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean)
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/")
    const isLast = index === pathSegments.length - 1
    
    let title = segment
    if (path === "/admin") title = "Dashboard"
    if (path === "/admin/articles") title = "Articles"
    if (path === "/admin/cars") title = "Cars"
    if (path === "/admin/signals") title = "Signals"
    if (path === "/admin/database") title = "Database"
    if (path === "/admin/settings") title = "Settings"
    
    return { path, title, isLast }
  })

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:justify-start">
          {/* Mobile spacing for hamburger menu */}
          <div className="flex items-center lg:hidden">
            <div className="w-12"></div> {/* Space for mobile menu button */}
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator className="mx-2 text-gray-600" />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="text-white font-medium">
                          {crumb.title}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink 
                          href={crumb.path}
                          className="text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          {crumb.title}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right side could have additional controls */}
          <div className="flex items-center lg:ml-auto">
            {/* Future: Add user menu, notifications, etc. */}
          </div>
        </div>
      </div>
    </header>
  )
}