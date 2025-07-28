import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/components/language-provider"
import { QueryProvider } from "@/components/query-provider"
import { Analytics } from "@vercel/analytics/react"
import { WebsiteStructuredData } from "@/components/structured-data"
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup"
import { HeaderVisibilityProvider } from "@/contexts/header-visibility"
import { TTSProvider } from "@/contexts/tts-context"
import { AuthProvider } from "@/contexts/auth-context"
import { AuthModalProvider } from "@/contexts/auth-modal-context"
import { BookmarkProvider } from "@/contexts/bookmark-context"
import AuthInitializer from "@/components/auth-initializer"
import GlobalTTSHUD from "@/components/global-tts-hud"
import GlobalAuthModal from "@/components/global-auth-modal"
// import { ServiceWorkerRegister } from "@/components/service-worker-register"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  fallback: ["system-ui", "arial"],
  display: "swap"
})

export const metadata: Metadata = {
  title: "HKI 香港資訊 - Hong Kong Information Hub",
  description: "Stay updated with the latest news from Hong Kong's top sources. Get real-time news coverage from HKFP, SingTao, HK01, ONCC, and RTHK.",
  keywords: "Hong Kong news, 香港新聞, 香港資訊, HKFP, SingTao, HK01, ONCC, RTHK, local news, current events",
  authors: [{ name: "HKI Team" }],
  generator: 'v0.dev',
  applicationName: "HKI 香港資訊",
  referrer: "origin-when-cross-origin",
  creator: "HKI Team",
  publisher: "HKI 香港資訊",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://hki.zone'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_HK',
    url: 'https://hki.zone',
    title: 'HKI 香港資訊 - Hong Kong Information Hub',
    description: 'Stay updated with the latest news from Hong Kong\'s top sources. Get real-time news coverage from HKFP, SingTao, HK01, ONCC, and RTHK.',
    siteName: 'HKI 香港資訊',
    images: [
      {
        url: '/hki-logo-black.png',
        width: 1200,
        height: 630,
        alt: 'HKI 香港資訊 Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HKI 香港資訊 - Hong Kong Information Hub',
    description: 'Stay updated with the latest news from Hong Kong\'s top sources.',
    site: '@hki_zone',
    creator: '@hki_zone',
    images: ['/hki-logo-black.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <QueryProvider>
              <AuthProvider>
                <AuthModalProvider>
                  <BookmarkProvider>
                    <HeaderVisibilityProvider>
                      <TTSProvider>
                        <WebsiteStructuredData />
                        <ServiceWorkerCleanup />
                        <AuthInitializer />
                        {/* <ServiceWorkerRegister /> */}
                        {children}
                        <GlobalTTSHUD />
                        <GlobalAuthModal />
                        <Analytics />
                      </TTSProvider>
                    </HeaderVisibilityProvider>
                  </BookmarkProvider>
                </AuthModalProvider>
              </AuthProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}