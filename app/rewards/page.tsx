"use client"

import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award, Phone, Coffee, Bus } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function RewardsPage() {
  const handleRedeem = (reward: string, points: number) => {
    toast({
      title: "Reward Redeemed!",
      description: `You've redeemed ${reward}. Check your phone for details.`,
    })
  }

  return (
    <main className="flex min-h-screen flex-col">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Rewards</h1>
            <p className="text-muted-foreground">Earn rewards for saving lives</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <Award className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">250</p>
                  <p className="text-sm text-muted-foreground">Total points earned</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress to next tier</span>
                  <span>250/500</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-red-600 h-2.5 rounded-full" style={{ width: "50%" }}></div>
                </div>
                <p className="text-xs text-muted-foreground">Reach 500 points to unlock Gold Donor status</p>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-lg font-medium mt-6">Available Rewards</h2>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Phone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">100 MB Data Bundle</p>
                      <p className="text-xs text-muted-foreground">Valid for 7 days</p>
                    </div>
                  </div>
                  <Badge variant="outline">100 pts</Badge>
                </div>
                <Button
                  onClick={() => handleRedeem("100 MB Data Bundle", 100)}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                >
                  Redeem
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Phone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">200 Airtime Credit</p>
                      <p className="text-xs text-muted-foreground">Any network</p>
                    </div>
                  </div>
                  <Badge variant="outline">200 pts</Badge>
                </div>
                <Button
                  onClick={() => handleRedeem("200 Airtime Credit", 200)}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                >
                  Redeem
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Coffee className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">Coffee Shop Voucher</p>
                      <p className="text-xs text-muted-foreground">Valid at participating cafes</p>
                    </div>
                  </div>
                  <Badge variant="outline">300 pts</Badge>
                </div>
                <Button
                  onClick={() => handleRedeem("Coffee Shop Voucher", 300)}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  disabled
                >
                  Not Enough Points
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Bus className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">Transport Credit</p>
                      <p className="text-xs text-muted-foreground">For ride-sharing apps</p>
                    </div>
                  </div>
                  <Badge variant="outline">500 pts</Badge>
                </div>
                <Button
                  onClick={() => handleRedeem("Transport Credit", 500)}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  disabled
                >
                  Not Enough Points
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mt-6">
            <h3 className="font-medium mb-2">How to Earn Points</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Complete a donation</span>
                <span className="font-medium">+100 pts</span>
              </li>
              <li className="flex justify-between">
                <span>Emergency donation</span>
                <span className="font-medium">+150 pts</span>
              </li>
              <li className="flex justify-between">
                <span>Refer a friend</span>
                <span className="font-medium">+50 pts</span>
              </li>
              <li className="flex justify-between">
                <span>Complete your profile</span>
                <span className="font-medium">+25 pts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  )
}
