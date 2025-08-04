"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { EnhancedAuthProvider } from "@/contexts/enhanced-auth-context"

interface ClientLayoutProps {
  children: React.ReactNode
  locale: string
}

export default function ClientLayout({
  children,
  locale
}: ClientLayoutProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      suppressHydrationWarning
    >
      <EnhancedAuthProvider>
        <div lang={locale}>
          {children}
          <Toaster />
        </div>
      </EnhancedAuthProvider>
    </ThemeProvider>
  )
} 