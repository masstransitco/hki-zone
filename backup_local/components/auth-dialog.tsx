"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import LoginForm from "@/components/auth/login-form"
import RegisterForm from "@/components/auth/register-form"
import { useLanguage } from "@/components/language-provider"
import { X } from "lucide-react"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export default function AuthDialog({ 
  open, 
  onOpenChange, 
  title,
  description 
}: AuthDialogProps) {
  const { t } = useLanguage()
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  const handleAuthSuccess = () => {
    onOpenChange(false)
    setAuthView('login') // Reset to login view for next time
  }

  // Simplified scroll management - let Radix Dialog handle it
  useEffect(() => {
    if (!open) return

    // Ensure dialog content is scrollable on mobile
    const dialogContent = document.querySelector('[role="dialog"]')
    if (dialogContent) {
      const scrollableElements = dialogContent.querySelectorAll('.overflow-y-auto')
      scrollableElements.forEach((el) => {
        const element = el as HTMLElement
        element.style.webkitOverflowScrolling = 'touch'
        element.style.overscrollBehavior = 'contain'
      })
    }
  }, [open])

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-[420px] max-w-[95vw] max-h-[98dvh] sm:max-h-[90vh] my-1 sm:my-4 p-0 gap-0 bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl border border-gray-200/20 dark:border-neutral-700/20 shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-3xl overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => {
          // Prevent closing on outside clicks for proper modal behavior
          e.preventDefault()
        }}
        onInteractOutside={(e) => {
          // Prevent any interaction outside the dialog
          e.preventDefault()
        }}
      >
        {/* Visually hidden DialogTitle and DialogDescription for accessibility */}
        <DialogTitle className="sr-only">
          {authView === 'register' 
            ? "Sign up to HKI - Create your account" 
            : "Sign in to HKI - Welcome back"
          }
        </DialogTitle>
        <DialogDescription className="sr-only">
          {authView === 'register' 
            ? "Create your HKI account to bookmark articles and access personalized features. Fill out the form below to get started." 
            : "Sign in to your HKI account to access your bookmarks and personalized content. Enter your credentials below."
          }
        </DialogDescription>
        
        <div className="relative w-full flex flex-col min-h-0">
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-gray-50/90 dark:bg-neutral-800/90 hover:bg-gray-100/90 dark:hover:bg-neutral-700/90 transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md border border-gray-200/30 dark:border-neutral-600/30"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
          </button>

          {/* Header with subtle background */}
          <div className="relative flex-shrink-0 px-6 sm:px-8 pt-6 sm:pt-12 pb-4 sm:pb-8 bg-gradient-to-b from-gray-50/40 to-gray-100/20 dark:from-neutral-800/40 dark:to-neutral-900/20">
            <div className="text-center space-y-2 sm:space-y-3">
              {/* App logo */}
              <div className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/50 dark:shadow-black/50 border border-gray-200/50 dark:border-neutral-700/50">
                <img 
                  src="/hki-logo-black.png" 
                  alt="HKI Logo" 
                  className="w-6 h-6 sm:w-10 sm:h-10 dark:hidden"
                />
                <img 
                  src="/hki-logo-white.png" 
                  alt="HKI Logo" 
                  className="w-6 h-6 sm:w-10 sm:h-10 hidden dark:block"
                />
              </div>
              
              {authView === 'register' ? (
                <>
                  <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-neutral-100 tracking-tight leading-tight">
                    Sign up below to unlock the full potential of HKI
                  </h2>
                  <p className="text-sm text-gray-700 dark:text-neutral-400 font-medium">
                    By continuing, you agree to our privacy policy
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-neutral-100 tracking-tight leading-tight">
                    Welcome back
                  </h2>
                  <p className="text-sm text-gray-700 dark:text-neutral-400 font-medium">
                    Sign in to continue your journey
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Form content - scrollable */}
          <div 
            className="flex-1 overflow-y-auto px-6 sm:px-8 py-3 sm:py-6 space-y-3 sm:space-y-6 min-h-0"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(209 213 219) transparent'
            }}
          >
            {authView === 'login' ? (
              <div className="space-y-3 sm:space-y-5">
                <LoginForm 
                  onSuccess={handleAuthSuccess}
                  onSwitchToRegister={() => setAuthView('register')}
                />
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-5">
                <RegisterForm 
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => setAuthView('login')}
                />
              </div>
            )}

            {/* Switch between login/register */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-neutral-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-neutral-900 px-4 text-gray-600 dark:text-neutral-400 font-medium">
                  or
                </span>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')}
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-gray-800 dark:text-neutral-300 bg-gray-50/80 dark:bg-neutral-800/80 hover:bg-gray-100/80 dark:hover:bg-neutral-700/80 transition-all duration-200 backdrop-blur-sm border border-gray-200/50 dark:border-neutral-700/50 shadow-sm hover:shadow-md"
              >
                {authView === 'login' 
                  ? "New to HKI? Join our community"
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 sm:px-8 py-3 sm:py-6 bg-gray-50/60 dark:bg-neutral-800/30 border-t border-gray-200/50 dark:border-neutral-700/50">
            <p className="text-xs text-center text-gray-600 dark:text-neutral-400 leading-relaxed">
              Secure authentication powered by Supabase.<br />
              Your data is encrypted and protected.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}