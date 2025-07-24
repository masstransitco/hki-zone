"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import LoginForm from "@/components/auth/login-form"
import RegisterForm from "@/components/auth/register-form"
import { useLanguage } from "@/components/language-provider"

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

  const defaultTitle = title || t("auth.signInRequired")
  const defaultDescription = description || t("auth.signInToBookmark")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>
            {defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {authView === 'login' ? (
            <div className="space-y-4">
              <LoginForm 
                onSuccess={handleAuthSuccess}
                onSwitchToRegister={() => setAuthView('register')}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <RegisterForm 
                onSuccess={handleAuthSuccess}
                onSwitchToLogin={() => setAuthView('login')}
              />
            </div>
          )}

          <div className="flex items-center justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {authView === 'login' 
                ? t("auth.needAccount")
                : t("auth.haveAccount")
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}