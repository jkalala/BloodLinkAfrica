"use client"

import { useState } from "react"
import { Check, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter, usePathname } from "next/navigation"

interface Language {
  code: string
  name: string
  shortName: string
}

const languages: Language[] = [
  { code: "en", name: "English", shortName: "EN" },
  { code: "fr", name: "Français", shortName: "FR" },
  { code: "pt", name: "Português", shortName: "PT" },
  { code: "sw", name: "Kiswahili", shortName: "SW" },
]

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()

  // Extract current locale from pathname or default to 'en'
  const currentPathSegments = pathname.split("/")
  const currentLocale = languages.find((lang) => currentPathSegments[1] === lang.code)?.code || "en"

  const [selectedLanguage, setSelectedLanguage] = useState<string>(currentLocale)

  const currentLanguage = languages.find((lang) => lang.code === selectedLanguage)

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode)

    // Handle language change in URL
    const newPathSegments = [...currentPathSegments]

    if (languages.some((lang) => lang.code === currentPathSegments[1])) {
      // If current path already has a locale, replace it
      newPathSegments[1] = langCode
    } else {
      // Otherwise, add the locale at the beginning
      newPathSegments.splice(1, 0, langCode)
    }

    const newPath = newPathSegments.join("/")
    router.push(newPath)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 px-3 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-all duration-200"
        >
          <Languages className="h-3.5 w-3.5 mr-1.5 opacity-70" />
          <span className="font-medium text-sm">
            {currentLanguage?.shortName || "EN"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 p-1 bg-background/95 backdrop-blur-lg border-border/50 shadow-lg"
      >
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            className="flex items-center justify-between cursor-pointer rounded-md px-3 py-2 hover:bg-accent/50 transition-colors duration-150"
            onClick={() => handleLanguageChange(language.code)}
          >
            <span className="font-medium text-sm">
              {language.name}
            </span>
            {selectedLanguage === language.code && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
