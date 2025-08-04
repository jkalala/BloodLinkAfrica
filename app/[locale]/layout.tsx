"use client"

import type React from "react"
import { use } from "react"
import { I18nProviderClient } from "@/lib/i18n/client"
import { EnhancedAuthProvider } from "@/contexts/enhanced-auth-context"

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(params)
  return (
    <EnhancedAuthProvider>
      <I18nProviderClient locale={locale}>{children}</I18nProviderClient>
    </EnhancedAuthProvider>
  )
} 