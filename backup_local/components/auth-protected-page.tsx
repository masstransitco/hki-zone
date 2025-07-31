"use client"

import { ReactNode } from "react"
import { useAuth } from "@/hooks/redux-auth"
import { LoadingSpinner } from "@/components/loading-spinner"
import UnifiedHeader from "@/components/unified-header"
import FooterNav from "@/components/footer-nav"
import SideMenu from "@/components/side-menu"

interface AuthProtectedPageProps {
  children: ReactNode
  fallback?: ReactNode
  title?: string
  subtitle?: string
  icon?: ReactNode
  className?: string
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export default function AuthProtectedPage({
  children,
  fallback,
  title = "Sign in required",
  subtitle = "Please sign in to access this feature.",
  icon,
  className = "",
  isMenuOpen,
  onMenuOpenChange
}: AuthProtectedPageProps) {
  const { user, loading: authLoading, isReady } = useAuth()

  // Layout wrapper for consistent page structure
  const layoutWrapper = (content: ReactNode) => (
    <>
      <SideMenu isOpen={isMenuOpen} onOpenChange={onMenuOpenChange} />
      <div className="min-h-screen bg-background flex flex-col">
        <UnifiedHeader isMenuOpen={isMenuOpen} onMenuOpenChange={onMenuOpenChange} />
        <main className={`flex-1 overflow-hidden ${className}`}>
          {content}
        </main>
        <FooterNav />
      </div>
    </>
  )

  // Show loading spinner while auth is initializing
  if (!isReady || authLoading) {
    return layoutWrapper(
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  // Show sign-in prompt if not authenticated
  if (!user) {
    return layoutWrapper(
      fallback || (
        <div className="flex flex-col items-center justify-center h-screen px-6 text-center">
          {icon && <div className="text-muted-foreground mb-4">{icon}</div>}
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {title}
          </h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            {subtitle}
          </p>
          <div className="text-sm text-muted-foreground">
            Use the side menu to sign in or create an account.
          </div>
        </div>
      )
    )
  }

  // Render protected content
  return layoutWrapper(children)
}