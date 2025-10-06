"use client"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function PrivacyPolicyPage() {
  const { language } = useLanguage()
  const router = useRouter()
  const isEnglish = language === 'en'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEnglish ? 'Back' : '返回'}
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {isEnglish ? 'Privacy Policy' : '私隱政策'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEnglish ? 'Last updated: October 6, 2025' : '最後更新：2025年10月6日'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">

          {/* English Version */}
          <section className="mb-12">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">Privacy Policy (English)</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
                <p className="text-muted-foreground">
                  HKI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. Information We Collect</h3>
                <p className="text-muted-foreground mb-2">
                  We may collect the following types of information:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Personal Information:</strong> Email address, username, and profile information when you create an account</li>
                  <li><strong>Usage Data:</strong> Information about how you interact with our app, including pages viewed, content preferences, and feature usage</li>
                  <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, and mobile network information</li>
                  <li><strong>Location Data:</strong> Approximate location based on IP address (we do not collect precise GPS location)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">3. How We Use Your Information</h3>
                <p className="text-muted-foreground mb-2">
                  We use the collected information to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Personalize your experience and deliver relevant content</li>
                  <li>Communicate with you about updates, news, and features</li>
                  <li>Analyze usage patterns to enhance app functionality</li>
                  <li>Detect, prevent, and address technical issues and security threats</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">4. Information Sharing and Disclosure</h3>
                <p className="text-muted-foreground mb-2">
                  We do not sell your personal information. We may share your information in the following circumstances:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Service Providers:</strong> With third-party service providers who assist in operating our app (e.g., hosting, analytics)</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">5. Data Security</h3>
                <p className="text-muted-foreground">
                  We implement industry-standard security measures to protect your information. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">6. Your Rights and Choices</h3>
                <p className="text-muted-foreground mb-2">
                  You have the following rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Access and update your account information at any time</li>
                  <li>Request deletion of your account and associated data</li>
                  <li>Opt-out of promotional communications</li>
                  <li>Control cookie preferences through your browser settings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">7. Children's Privacy</h3>
                <p className="text-muted-foreground">
                  Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">8. International Data Transfers</h3>
                <p className="text-muted-foreground">
                  Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">9. Changes to This Privacy Policy</h3>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">10. Contact Us</h3>
                <p className="text-muted-foreground">
                  If you have questions about this Privacy Policy, please contact us at:
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Aircity Operating System (HK) Limited</strong><br />
                  Email: <a href="mailto:privacy@air.city" className="text-primary hover:underline">privacy@air.city</a><br />
                  Website: <a href="https://air.city" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://air.city</a>
                </p>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-border my-12"></div>

          {/* Chinese Version */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">私隱政策（中文）</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. 引言</h3>
                <p className="text-muted-foreground">
                  HKI（「我們」、「我們的」或「本公司」）致力於保護您的私隱。本私隱政策說明我們如何在您使用我們的流動應用程式和網站時收集、使用、披露和保護您的資料。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. 我們收集的資料</h3>
                <p className="text-muted-foreground mb-2">
                  我們可能會收集以下類型的資料：
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>個人資料：</strong>當您建立帳戶時的電郵地址、用戶名稱和個人檔案資料</li>
                  <li><strong>使用數據：</strong>有關您如何與我們的應用程式互動的資料，包括瀏覽的頁面、內容偏好和功能使用情況</li>
                  <li><strong>裝置資料：</strong>裝置類型、作業系統、唯一裝置識別碼和流動網絡資料</li>
                  <li><strong>位置數據：</strong>基於IP地址的大約位置（我們不會收集精確的GPS位置）</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">3. 我們如何使用您的資料</h3>
                <p className="text-muted-foreground mb-2">
                  我們使用收集的資料來：
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>提供、維護和改進我們的服務</li>
                  <li>個人化您的體驗並提供相關內容</li>
                  <li>與您溝通有關更新、新聞和功能的資訊</li>
                  <li>分析使用模式以增強應用程式功能</li>
                  <li>檢測、預防和解決技術問題和安全威脅</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">4. 資料共享和披露</h3>
                <p className="text-muted-foreground mb-2">
                  我們不會出售您的個人資料。我們可能在以下情況下共享您的資料：
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>服務提供者：</strong>與協助我們營運應用程式的第三方服務提供者（例如託管、分析）</li>
                  <li><strong>法律要求：</strong>當法律要求或為保護我們的權利和安全時</li>
                  <li><strong>業務轉讓：</strong>與合併、收購或資產出售有關的情況</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">5. 資料安全</h3>
                <p className="text-muted-foreground">
                  我們實施業界標準的安全措施來保護您的資料。然而，沒有任何透過互聯網傳輸或電子儲存的方法是100%安全的，我們無法保證絕對安全。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">6. 您的權利和選擇</h3>
                <p className="text-muted-foreground mb-2">
                  您對個人資料擁有以下權利：
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>隨時存取和更新您的帳戶資料</li>
                  <li>要求刪除您的帳戶和相關資料</li>
                  <li>選擇退出促銷通訊</li>
                  <li>透過瀏覽器設定控制Cookie偏好</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">7. 兒童私隱</h3>
                <p className="text-muted-foreground">
                  我們的服務不針對13歲以下的兒童。我們不會故意收集13歲以下兒童的個人資料。如果您認為我們收集了13歲以下兒童的資料，請聯絡我們。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">8. 國際數據傳輸</h3>
                <p className="text-muted-foreground">
                  您的資料可能會被傳輸到您居住國家以外的國家進行處理。我們確保採取適當的保護措施，按照本私隱政策保護您的資料。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">9. 本私隱政策的變更</h3>
                <p className="text-muted-foreground">
                  我們可能會不時更新本私隱政策。我們會透過在此頁面發佈新的私隱政策並更新「最後更新」日期來通知您任何變更。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">10. 聯絡我們</h3>
                <p className="text-muted-foreground">
                  如果您對本私隱政策有任何疑問，請聯絡我們：
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Aircity Operating System (HK) Limited</strong><br />
                  電郵：<a href="mailto:privacy@air.city" className="text-primary hover:underline">privacy@air.city</a><br />
                  網站：<a href="https://air.city" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://air.city</a>
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-xs text-muted-foreground text-center">
            © 2025{' '}
            <a
              href="https://air.city"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline"
            >
              Aircity Operating System (HK) Limited
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
