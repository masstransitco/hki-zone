import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import UserProfile from "@/components/user-profile"
import LoadingSkeleton from "@/components/loading-skeleton"

export default function ProfilePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-20">
        <Suspense fallback={<LoadingSkeleton />}>
          <UserProfile />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}
