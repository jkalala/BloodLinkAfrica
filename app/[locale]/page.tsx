"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ResponsiveLayout } from "@/components/responsive-layout"
import { Heart, Droplet, Users, Clock } from "lucide-react"
import { useI18n } from "@/lib/i18n/client"
import { useParams } from "next/navigation"

export default function LocalizedHome() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
        <div className="flex-1 p-4 flex flex-col items-center justify-center space-y-8 text-center">
        <div className="space-y-4 max-w-md">
          <div className="flex justify-center">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full shadow-md">
              <Heart className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("app.name")}</h1>
          <p className="text-xl text-gray-700 dark:text-gray-300">
            {t("app.tagline")}
          </p>
        </div>

        <div className="w-full max-w-sm space-y-5">
          <Button
            asChild
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 
                      dark:from-red-700 dark:to-red-600 dark:hover:from-red-600 dark:hover:to-red-500 
                      py-7 text-base font-medium text-white shadow-lg hover:shadow-xl 
                      transition-all duration-300 rounded-xl border-b-4 border-red-800 dark:border-red-900
                      hover:translate-y-[-2px] active:translate-y-[1px]"
          >
            <Link href={`/${locale}/register`} className="flex items-center justify-center w-full">
              <Droplet className="mr-2 h-5 w-5" />
              {t("auth.registerDonor")}
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full border-2 border-red-600 dark:border-red-500 text-red-700 dark:text-red-400 
                      py-7 text-base font-medium hover:bg-red-50 dark:hover:bg-red-950/30 
                      shadow-md hover:shadow-lg transition-all duration-300 rounded-xl
                      hover:border-red-700 dark:hover:border-red-400 hover:text-red-800 dark:hover:text-red-300
                      hover:translate-y-[-2px] active:translate-y-[1px]"
          >
            <Link href={`/${locale}/request`} className="flex items-center justify-center w-full">
              <Heart className="mr-2 h-5 w-5" />
              {t("request.title")}
            </Link>
          </Button>

          <Button
            asChild
            className="w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                      hover:bg-gray-100 dark:hover:bg-gray-700 py-7 text-base font-medium
                      shadow-md hover:shadow-lg transition-all duration-300 rounded-xl border border-gray-200 dark:border-gray-700
                      hover:translate-y-[-2px] active:translate-y-[1px]"
          >
            <Link href={`/${locale}/login`} className="flex items-center justify-center w-full">
              <Users className="mr-2 h-5 w-5" />
              {t("auth.login")}
            </Link>
          </Button>
        </div>

        <div className="space-y-6 mt-8 max-w-lg">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <Droplet className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-medium mb-2">Register</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sign up with your blood type and location</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <Users className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-medium mb-2">Connect</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get alerts when your blood type is needed nearby
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <Clock className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-medium mb-2">Respond</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Quickly respond to help save lives</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 max-w-lg w-full mt-8">
          <h3 className="font-semibold mb-3">Did you know?</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            One blood donation can save up to three lives. Every two seconds, someone needs blood. Join our community of
            donors today and make a difference.
          </p>
        </div>
      </div>
    </main>
  )
} 