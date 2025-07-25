"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/components/language-provider'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

interface LoginFormProps {
  onSuccess?: () => void
  onSwitchToRegister?: () => void
}

export default function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const { signIn, loading } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    // Basic validation
    if (!email || !password) {
      setError(t('auth.fillAllFields'))
      setIsSubmitting(false)
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(t('auth.enterValidEmail'))
      setIsSubmitting(false)
      return
    }

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
    } else {
      onSuccess?.()
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-800 dark:text-neutral-200">{t('auth.email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500 dark:text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t('auth.enterEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              disabled={loading || isSubmitting}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-800 dark:text-neutral-200">{t('auth.password')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500 dark:text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t('auth.enterPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              disabled={loading || isSubmitting}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
              disabled={loading || isSubmitting}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {t('auth.signingIn')}
            </div>
          ) : (
            t('auth.signInButton')
          )}
        </Button>
      </form>

      <div className="text-center space-y-2">
        <Button
          variant="link"
          size="sm"
          className="text-sm text-gray-600 dark:text-muted-foreground"
          onClick={() => {
            // TODO: Implement forgot password
            console.log('Forgot password clicked')
          }}
        >
          Forgot your password?
        </Button>
        
        {onSwitchToRegister && (
          <div className="text-sm text-gray-600 dark:text-muted-foreground">
            {t('auth.dontHaveAccount')}{' '}
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto font-medium text-primary"
              onClick={onSwitchToRegister}
            >
              {t('auth.createOne')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}