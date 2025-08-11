"use client"

import { MessageCircle, Phone } from "lucide-react"
import { useLanguage } from "@/hooks/use-language-redux"
import LongLogo from "./long-logo"

// Simple card component for What We Do section
function FeatureCard({ title, description }: {
  title: string
  description: string
}) {
  return (
    <div className="bg-background/80 backdrop-blur border border-border/60 rounded-xl p-6 h-full">
      <h3 className="text-base font-semibold text-foreground mb-3">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

export default function AboutUs() {
  const { t } = useLanguage()

  return (
    <div className="h-screen overflow-y-auto snap-y snap-mandatory">
      {/* Page 1: Hero with Video (100vh) */}
      <section className="h-screen snap-start relative flex items-center justify-center overflow-hidden">
        {/* Video Container with explicit z-index and iOS fixes */}
        <div className="absolute inset-0 z-0" style={{ zIndex: 0 }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={{ 
              zIndex: 0,
              isolation: 'isolate',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)'
            }}
          >
            <source src="/videos/hki-newsroom-video.mp4" type="video/mp4" />
          </video>
        </div>
        
        {/* Overlay with higher z-index and iOS stacking context */}
        <div className="absolute inset-0 bg-black/50 z-10" style={{ zIndex: 10, isolation: 'isolate' }} />
        
        {/* Content with highest z-index and forced stacking context for iOS */}
        <div 
          className="relative z-20 text-center text-white px-6 max-w-4xl mx-auto" 
          style={{ 
            position: 'relative',
            zIndex: 20,
            isolation: 'isolate',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)'
          }}
        >
          <div className="mb-8 flex justify-center">
            <LongLogo 
              className="h-auto w-full max-w-[280px] md:max-w-[400px] relative z-30"
              style={{
                filter: 'brightness(0) invert(1)',
                position: 'relative',
                zIndex: 30,
                isolation: 'isolate',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)'
              }}
            />
          </div>
          
          <h1 
            className="text-xl md:text-3xl lg:text-4xl mb-6 font-light relative z-30"
            style={{ 
              position: 'relative',
              zIndex: 30,
              isolation: 'isolate',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)'
            }}
          >
            {t('about.hero.subtitle')}
          </h1>
          
          <div 
            className="w-20 h-0.5 bg-white/60 mx-auto mb-12 relative z-30"
            style={{ 
              position: 'relative',
              zIndex: 30,
              isolation: 'isolate',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)'
            }}
          />
          
          {/* Mission Statement */}
          <div 
            className="mt-16 relative z-30"
            style={{ 
              position: 'relative',
              zIndex: 30,
              isolation: 'isolate',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)'
            }}
          >
            <h2 className="text-2xl md:text-4xl font-bold mb-6">
              {t('about.mission.title')}
            </h2>
            <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-3xl mx-auto">
              {t('about.mission.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Page 2: What We Do + Contact (100vh) */}
      <section className="min-h-screen snap-start bg-background flex flex-col">
        {/* Spacer for header nav */}
        <div className="h-16" />
        
        {/* What We Do Section */}
        <div className="px-6 py-8">
          <div className="max-w-6xl mx-auto">
            {/* For Readers Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                {t('about.whatWeDo.title')}
              </h2>
              <div className="w-12 h-0.5 bg-primary mx-auto" />
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FeatureCard
                title={t('about.whatWeDo.filters.title')}
                description={t('about.whatWeDo.filters.description')}
              />
              <FeatureCard
                title={t('about.whatWeDo.enhances.title')}
                description={t('about.whatWeDo.enhances.description')}
              />
              <FeatureCard
                title={t('about.whatWeDo.delivers.title')}
                description={t('about.whatWeDo.delivers.description')}
              />
              <FeatureCard
                title={t('about.whatWeDo.clean.title')}
                description={t('about.whatWeDo.clean.description')}
              />
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-muted/50 px-6 py-8 border-t">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-center mb-6">
              {t('about.contact.title')}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Info */}
              <div className="bg-background rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t('about.companyName')}
                    </p>
                    <p className="text-sm font-medium">
                      Aircity Operating System (HK) Limited
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t('about.address')}
                    </p>
                    <address className="text-sm not-italic">
                      Rm 830, 8/F, Beverley Commercial Centre<br />
                      No. 87-105 Chatham Road South<br />
                      Tsim Sha Tsui, Hong Kong
                    </address>
                  </div>
                </div>
              </div>

              {/* Contact Buttons */}
              <div className="bg-background rounded-lg p-6 flex items-center justify-center">
                <div className="flex gap-4">
                  <a 
                    href="tel:+85290890874"
                    className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
                    aria-label="Call +852 90890874"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                  <a 
                    href="https://wa.me/85290890874"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Spacer for footer nav bar - matches footer nav height exactly */}
        <div className="h-[76px]" />
      </section>
    </div>
  )
}