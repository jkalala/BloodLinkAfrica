"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { initiateVerification, confirmVerification } from "../../actions/verification-actions"
import { useI18n } from "@/lib/i18n/client"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = params.locale as string
  const phone = searchParams.get("phone") || ""
  const redirect = searchParams.get("redirect") || `/${locale}/dashboard`
  const t = useI18n()

  const [verificationCode, setVerificationCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [hasInitialCodeSent, setHasInitialCodeSent] = useState(false)

  useEffect(() => {
    // Start countdown for resend button
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      setCanResend(true)
    }
  }, [countdown, canResend])

  useEffect(() => {
    // Send verification code only once when page loads
    if (phone && !hasInitialCodeSent) {
      handleSendCode()
      setHasInitialCodeSent(true)
    }
  }, [phone, hasInitialCodeSent])

  const handleSendCode = async () => {
    if (!phone) {
      toast({
        title: t("verification.missingPhone"),
        description: t("verification.enterPhoneNumber"),
        variant: "destructive",
      })
      return
    }

    if (isLoading) {
      return // Prevent multiple simultaneous requests
    }

    setIsLoading(true)
    setCanResend(false)
    setCountdown(60)

    try {
      const result = await initiateVerification(phone)

      if (result.success) {
        toast({
          title: t("verification.codeSent"),
          description: t("verification.checkPhone"),
        })
      } else {
        toast({
          title: t("verification.sendFailed"),
          description: result.message,
          variant: "destructive",
        })
        setCanResend(true)
      }
    } catch (error) {
      toast({
        title: t("verification.error"),
        description: t("verification.tryAgain"),
        variant: "destructive",
      })
      setCanResend(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verificationCode) {
      toast({
        title: t("verification.missingCode"),
        description: t("verification.enterCode"),
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await confirmVerification(phone, verificationCode)

      if (result.success) {
        toast({
          title: t("verification.success"),
          description: t("verification.phoneVerified"),
        })

        // Make sure we use the locale-prefixed redirect URL
        const redirectUrl = redirect.startsWith('/') ? redirect : `/${locale}${redirect}`
        console.log("Redirecting to:", redirectUrl)
        
        // Redirect after successful verification
        setTimeout(() => {
          router.push(redirectUrl)
        }, 1500)
      } else {
        toast({
          title: t("verification.failed"),
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t("verification.error"),
        description: t("verification.tryAgain"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("verification.title")}</CardTitle>
            <CardDescription>{t("verification.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("verification.phoneNumber")}</Label>
              <Input id="phone" value={phone} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">{t("verification.code")}</Label>
              <Input
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder={t("verification.enterCodePlaceholder")}
                maxLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              onClick={handleVerify}
              className="w-full bg-red-700 hover:bg-red-800 text-white"
              disabled={isLoading}
            >
              {isLoading ? t("verification.verifying") : t("verification.verify")}
            </Button>
            <Button variant="outline" onClick={handleSendCode} disabled={isLoading || !canResend} className="w-full">
              {canResend ? t("verification.resend") : `${t("verification.resendIn")} ${countdown}s`}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Toaster />
    </main>
  )
} 