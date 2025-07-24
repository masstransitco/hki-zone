"use client"

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

export default function AuthInitializer() {
  const { loading } = useAuth()

  useEffect(() => {
    // This component helps ensure auth is properly initialized on the client
    if (!loading) {
      console.log('Auth initialization complete')
    }
  }, [loading])

  return null
}