"use client"

import { useAuthModal } from "@/contexts/auth-modal-context"
import { useAuth } from "@/hooks/redux-auth"
import AuthDialog from "./auth-dialog"

export default function GlobalAuthModal() {
  const { isAuthModalOpen, hideAuthModal, authModalOptions } = useAuthModal()
  const { user } = useAuth()

  // Auto-close if user becomes authenticated
  if (user && isAuthModalOpen) {
    hideAuthModal()
    authModalOptions?.onSuccess?.()
  }

  return (
    <AuthDialog
      open={isAuthModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          hideAuthModal()
        }
      }}
      title={authModalOptions?.title || "Sign in required"}
      description={authModalOptions?.description || "Please sign in to continue"}
    />
  )
}