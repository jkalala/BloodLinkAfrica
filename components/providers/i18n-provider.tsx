"use client"

import { usePathname } from "next/navigation"
import { I18nProviderClient } from "@/lib/i18n/client"

const locales = ["en", "fr", "pt", "sw"]

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentPathSegments = pathname.split("/")
  const currentLocale = locales.find((lang) => currentPathSegments[1] === lang) || "en"

  return <I18nProviderClient locale={currentLocale}>{children}</I18nProviderClient>
} 