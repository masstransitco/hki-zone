"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { X, User, LogOut, UserPlus, LogIn } from "lucide-react"
import LiveNewsIndicator from "./live-news-indicator"
import LanguageSelector from "./language-selector"
import ThemeToggle from "./theme-toggle"
import LoginForm from "./auth/login-form"
import RegisterForm from "./auth/register-form"
import LongLogo from "./long-logo"
import { cn } from "@/lib/utils"
import { useSwipeGesture } from "@/hooks/use-swipe-gesture"
import { useAuth } from "@/hooks/redux-auth"
import { useLanguage } from "./language-provider"

interface SideMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function SideMenu({ isOpen, onOpenChange }: SideMenuProps) {
  const { user, session, signOut, loading, sessionValid } = useAuth()
  const { t } = useLanguage()
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)
  const touchStartX = React.useRef(0)
  const [authView, setAuthView] = React.useState<'login' | 'register' | null>(null)
  const [shouldRender, setShouldRender] = React.useState(false)

  // Control when menu should be rendered (for animation and to avoid Next.js warnings)
  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
    } else {
      // Delay removal to allow close animation
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Use swipe gesture for menu dismissal
  useSwipeGesture(menuRef, {
    onSwipeLeft: () => onOpenChange(false),
    threshold: 30,
    enabled: isOpen
  })

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onOpenChange])

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Prevent iOS bounce
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [isOpen])

  // Handle touch drag for visual feedback
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const currentX = e.touches[0].clientX
    const deltaX = currentX - touchStartX.current
    if (deltaX < 0) {
      setDragX(Math.max(deltaX, -100))
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragX < -50) {
      onOpenChange(false)
    }
    setDragX(0)
  }

  const handleAuthSuccess = () => {
    setAuthView(null)
    // Optionally close the menu after successful auth
    // onOpenChange(false)
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  // Reset auth view when menu opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setAuthView(null)
    }
  }, [isOpen])

  // Don't render anything if menu shouldn't be visible
  if (!shouldRender) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className={cn(
            "fixed inset-0 z-[95] bg-black/20 backdrop-blur-sm transition-opacity duration-300",
            isDragging ? "transition-none" : ""
          )}
          style={{
            opacity: isDragging ? 1 - Math.abs(dragX) / 200 : 1
          }}
          onClick={() => onOpenChange(false)}
        />
      )}
      
      {/* Side Menu */}
      <div
        ref={menuRef}
        className={cn(
          "fixed left-0 top-0 h-full w-80 max-w-[80vw] z-[96] bg-background border-r border-border shadow-lg",
          "flex flex-col gap-6 p-6 transition-transform ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isDragging ? "duration-0" : "duration-300"
        )}
        style={{
          transform: isOpen ? `translateX(${dragX}px)` : 'translateX(-100%)',
          willChange: 'transform'
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.sideMenu') || 'Side menu'}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-1 flex items-center">
            <LongLogo 
              className="object-contain"
              style={{
                width: '35vw',
                maxWidth: '280px',
                height: 'auto'
              }}
            />
          </div>
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-11 h-11 p-0 text-foreground hover:bg-muted touch-manipulation flex-shrink-0"
            onClick={() => {
              if (authView) {
                setAuthView(null)
              } else {
                onOpenChange(false)
              }
            }}
            aria-label={authView ? t('menu.backToMenu') : t('menu.closeMenu')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col">
          {authView === 'login' ? (
            <LoginForm
              onSuccess={handleAuthSuccess}
              onSwitchToRegister={() => setAuthView('register')}
            />
          ) : authView === 'register' ? (
            <RegisterForm
              onSuccess={handleAuthSuccess}
              onSwitchToLogin={() => setAuthView('login')}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Authentication Section */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">{t('menu.account')}</h3>
                <div className="pl-2 space-y-2">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {t('menu.loading')}
                    </div>
                  ) : user && session && sessionValid ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.profile?.username 
                              ? `@${user.profile.username}` 
                              : user.email 
                                ? `@${user.email.split('@')[0]}` 
                                : 'User'
                            }
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('profile.signOut')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setAuthView('login')}
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {t('auth.signInButton')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setAuthView('register')}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('auth.createAccountButton')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* System Settings */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">{t('menu.systemStatus')}</h3>
                <div className="pl-2">
                  <LiveNewsIndicator />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">{t('profile.language')}</h3>
                <div className="pl-2">
                  <LanguageSelector />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">{t('menu.theme')}</h3>
                <div className="pl-2">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}