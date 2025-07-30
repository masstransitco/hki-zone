"use client"

import React from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from '@/store'

interface ReduxProviderProps {
  children: React.ReactNode
}

// Loading component for PersistGate
const PersistenceLoader = () => (
  <div className="fixed inset-0 bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
)

export default function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      <PersistGate 
        loading={<PersistenceLoader />} 
        persistor={persistor}
        onBeforeLift={() => {
          // Ensure language is hydrated
          const state = store.getState()
          if (!state.language?.isHydrated) {
            store.dispatch({ type: 'language/hydrate' })
          }
          console.log('Redux store hydrating...')
        }}
      >
        {children}
      </PersistGate>
    </Provider>
  )
}