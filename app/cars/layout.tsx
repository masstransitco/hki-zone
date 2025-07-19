import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cars | Panora",
  description: "Latest car listings and automotive news from Hong Kong. Find your perfect vehicle from trusted dealers.",
  keywords: ["Hong Kong cars", "car listings", "automotive", "vehicles", "28car"],
  openGraph: {
    title: "Cars | Panora",
    description: "Latest car listings and automotive news from Hong Kong",
    type: "website",
    siteName: "Panora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cars | Panora",
    description: "Latest car listings and automotive news from Hong Kong",
  },
}

export default function CarsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}