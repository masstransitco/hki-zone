"use client"

import type React from "react"
import { useEffect } from "react"
import { useDispatch } from "react-redux"
import { hydrate } from "@/store/languageSlice"

// This component just ensures language hydration happens
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch()

  useEffect(() => {
    // Hydrate language state from localStorage
    dispatch(hydrate())
  }, [dispatch])

  return <>{children}</>
}