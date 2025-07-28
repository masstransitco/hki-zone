"use client"

import { useAuth } from "@/hooks/redux-auth"

export default function AuthInitializer() {
  // Redux auth initializes automatically via the useAuth hook
  // This component is now a lightweight wrapper that ensures initialization
  useAuth()
  
  return null
}