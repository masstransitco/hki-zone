"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/components/language-provider'
import { Eye, EyeOff, Mail, Lock, User, Check, X } from 'lucide-react'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { cn } from '@/lib/utils'

interface RegisterFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { signUp, checkUsernameAvailable, loading } = useAuth()
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null)

  // Username validation
  const validateUsername = (username: string) => {
    if (!username) return 'idle'
    if (!username.startsWith('@')) return 'invalid'
    if (username.length < 4) return 'invalid' // @ + at least 3 characters
    if (username.length > 20) return 'invalid'
    if (!/^@[a-zA-Z0-9_]+$/.test(username)) return 'invalid'
    return 'valid'
  }

  // Check username availability with debounce
  useEffect(() => {
    const checkUsername = async () => {
      if (validateUsername(username) !== 'valid') {
        setUsernameStatus(validateUsername(username) as any)
        return
      }

      setUsernameStatus('checking')
      
      const isAvailable = await checkUsernameAvailable(username.slice(1)) // Remove @ prefix
      setUsernameStatus(isAvailable ? 'available' : 'taken')
    }

    const debounceTimer = setTimeout(checkUsername, 500)
    return () => clearTimeout(debounceTimer)
  }, [username, checkUsernameAvailable])

  // Check password confirmation match
  useEffect(() => {
    if (!confirmPassword) {
      setPasswordsMatch(null)
      return
    }
    
    if (password && confirmPassword) {
      setPasswordsMatch(password === confirmPassword)
    }
  }, [password, confirmPassword])

  const getUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      case 'available':
        return <CheckCircleIcon sx={{ fontSize: 16 }} className="text-green-600" />
      case 'taken':
        return <BlockIcon sx={{ fontSize: 16 }} className="text-red-600" />
      case 'invalid':
        return <X className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getUsernameHelperText = () => {
    switch (usernameStatus) {
      case 'invalid':
        return t('auth.usernameInvalid')
      case 'checking':
        return t('auth.checkingAvailability')
      case 'available':
        return t('auth.usernameAvailable')
      case 'taken':
        return t('auth.usernameTaken')
      default:
        return t('auth.chooseUsername')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      setError(t('auth.fillAllFields'))
      setIsSubmitting(false)
      return
    }

    if (validateUsername(username) !== 'valid') {
      setError(t('auth.enterValidUsername'))
      setIsSubmitting(false)
      return
    }

    if (usernameStatus !== 'available') {
      setError(t('auth.chooseAvailableUsername'))
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

    // Password validation
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      setIsSubmitting(false)
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'))
      setIsSubmitting(false)
      return
    }

    try {
      const { error } = await signUp(email, password, username.slice(1)) // Remove @ prefix
      
      console.log('Sign up result:', { error })

      if (error) {
        console.error('Sign up error:', error)
        setError(error.message || 'Registration failed. Please try again.')
      } else {
        console.log('Registration successful!')
        setError('') // Clear any existing errors
        // Show success message
        setSuccess(t('auth.accountCreated'))
        // Call success callback after a delay to show the message
        setTimeout(() => {
          onSuccess?.()
        }, 2000)
      }
    } catch (err) {
      console.error('Unexpected error during registration:', err)
      setError('An unexpected error occurred. Please try again.')
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
      
      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-gray-800 dark:text-neutral-200">{t('auth.username')}</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-gray-500 dark:text-muted-foreground" />
            <Input
              id="username"
              type="text"
              placeholder="@stevenchan"
              value={username}
              onChange={(e) => {
                let value = e.target.value
                if (!value.startsWith('@') && value.length > 0) {
                  value = '@' + value
                }
                setUsername(value)
              }}
              className={cn(
                "pl-10 pr-10",
                usernameStatus === 'available' && "border-green-500",
                (usernameStatus === 'taken' || usernameStatus === 'invalid') && "border-red-500"
              )}
              disabled={loading || isSubmitting}
              autoComplete="username"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {username && (
                <button
                  type="button"
                  onClick={() => {
                    setUsername('')
                    setUsernameStatus('idle')
                  }}
                  className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                  disabled={loading || isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {getUsernameStatusIcon()}
            </div>
          </div>
          <p className={cn(
            "text-xs",
            usernameStatus === 'available' && "text-green-600",
            (usernameStatus === 'taken' || usernameStatus === 'invalid') && "text-red-600",
            usernameStatus === 'idle' && "text-gray-600 dark:text-muted-foreground"
          )}>
            {getUsernameHelperText()}
          </p>
        </div>

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
              placeholder={t('auth.createPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              disabled={loading || isSubmitting}
              autoComplete="new-password"
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
          <p className="text-xs text-gray-600 dark:text-muted-foreground">
            {t('auth.passwordMinLength')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-gray-800 dark:text-neutral-200">{t('auth.confirmPassword')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500 dark:text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t('auth.confirmYourPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(
                "pl-10 pr-12",
                passwordsMatch === true && "border-green-500",
                passwordsMatch === false && "border-red-500"
              )}
              disabled={loading || isSubmitting}
              autoComplete="new-password"
            />
            <div className="absolute right-3 top-3 flex items-center gap-1">
              {passwordsMatch !== null && (
                passwordsMatch ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )
              )}
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                disabled={loading || isSubmitting}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || isSubmitting || usernameStatus !== 'available'}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {t('auth.creatingAccount')}
            </div>
          ) : (
            t('auth.createAccountButton')
          )}
        </Button>
      </form>

      {onSwitchToLogin && (
        <div className="text-center text-sm text-gray-600 dark:text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto font-medium text-primary"
            onClick={onSwitchToLogin}
          >
            {t('auth.signInHere')}
          </Button>
        </div>
      )}
    </div>
  )
}