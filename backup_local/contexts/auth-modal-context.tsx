"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

interface AuthModalContextType {
  showAuthModal: (options?: AuthModalOptions) => void
  hideAuthModal: () => void
  isAuthModalOpen: boolean
  authModalOptions: AuthModalOptions | null
}

interface AuthModalOptions {
  title?: string
  description?: string
  onSuccess?: () => void
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined)

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<AuthModalOptions | null>(null)

  const showAuthModal = useCallback((modalOptions?: AuthModalOptions) => {
    setOptions(modalOptions || null)
    setIsOpen(true)
  }, [])

  const hideAuthModal = useCallback(() => {
    setIsOpen(false)
    // Clear options after animation completes
    setTimeout(() => setOptions(null), 200)
  }, [])

  return (
    <AuthModalContext.Provider 
      value={{
        showAuthModal,
        hideAuthModal,
        isAuthModalOpen: isOpen,
        authModalOptions: options
      }}
    >
      {children}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider")
  }
  return context
}