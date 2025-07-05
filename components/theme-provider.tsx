"use client"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider 
      {...props}
      // Ensure smooth hydration by not showing theme flash
      enableColorScheme={false}
      storageKey="panora-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
