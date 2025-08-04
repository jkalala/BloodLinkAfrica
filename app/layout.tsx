import ClientLayout from "./client-layout"
import { metadata } from "./metadata"
import "./globals.css"
import ErrorBoundary from "@/components/error-boundary"

interface RootLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export { metadata }

export default function RootLayout({
  children,
  params: { locale }
}: RootLayoutProps) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <ClientLayout locale={locale}>
            {children}
          </ClientLayout>
        </ErrorBoundary>
      </body>
    </html>
  )
}
