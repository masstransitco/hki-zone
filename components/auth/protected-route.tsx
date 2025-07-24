"use client"

import React from 'react'
import { useAuth } from '@/contexts/auth-context'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Authentication Required</h3>
          <p className="text-muted-foreground">
            Please sign in to access this feature.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}