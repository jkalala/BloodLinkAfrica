"use client"

import { useI18n } from "@/lib/i18n/client"
import { useState } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { Trophy, Gift, Star, Heart, Medal, Award } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  progress: number
  completed: boolean
  reward: string
}

interface Reward {
  id: string
  title: string
  description: string
  points: number
  redeemed: boolean
  expiryDate?: string
}

export default function RewardsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  const [achievements] = useState<Achievement[]>([
    {
      id: "1",
      title: "First Donation",
      description: "Complete your first blood donation",
      icon: <Heart className="h-6 w-6 text-red-500" />,
      progress: 100,
      completed: true,
      reward: "100 points"
    },
    {
      id: "2",
      title: "Regular Donor",
      description: "Donate blood 5 times",
      icon: <Star className="h-6 w-6 text-yellow-500" />,
      progress: 60,
      completed: false,
      reward: "500 points"
    },
    {
      id: "3",
      title: "Lifesaver",
      description: "Donate blood 10 times",
      icon: <Medal className="h-6 w-6 text-blue-500" />,
      progress: 30,
      completed: false,
      reward: "1000 points"
    }
  ])

  const [rewards] = useState<Reward[]>([
    {
      id: "1",
      title: "Free Health Check",
      description: "Comprehensive health checkup at partner clinics",
      points: 500,
      redeemed: false,
      expiryDate: "2024-12-31"
    },
    {
      id: "2",
      title: "Donor T-Shirt",
      description: "Exclusive BloodLink donor t-shirt",
      points: 300,
      redeemed: false
    },
    {
      id: "3",
      title: "Movie Tickets",
      description: "2 movie tickets at partner cinemas",
      points: 800,
      redeemed: true,
      expiryDate: "2024-06-30"
    }
  ])

  const totalPoints = 750
  const nextMilestone = 1000

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Rewards & Achievements</h1>
              <p className="text-muted-foreground">Track your progress and redeem rewards</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Points</CardTitle>
                  <CardDescription>Earn points with each donation</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{totalPoints}</div>
                  <div className="text-sm text-muted-foreground">Total Points</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress to next milestone</span>
                  <span>{totalPoints}/{nextMilestone} points</span>
                </div>
                <Progress value={(totalPoints / nextMilestone) * 100} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="achievements" className="space-y-4">
            <TabsList>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="achievements" className="space-y-4">
              {achievements.map((achievement) => (
                <Card key={achievement.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{achievement.title}</h3>
                          {achievement.completed && (
                            <Badge variant="secondary">Completed</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        <div className="mt-2 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{achievement.progress}%</span>
                          </div>
                          <Progress value={achievement.progress} />
                          <p className="text-sm text-muted-foreground">
                            Reward: {achievement.reward}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="rewards" className="space-y-4">
              {rewards.map((reward) => (
                <Card key={reward.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-green-500" />
                          <h3 className="font-semibold">{reward.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{reward.description}</p>
                        {reward.expiryDate && (
                          <p className="text-xs text-muted-foreground">
                            Expires: {reward.expiryDate}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{reward.points} points</div>
                        <Button
                          variant={reward.redeemed ? "secondary" : "default"}
                          disabled={reward.redeemed || totalPoints < reward.points}
                          className="mt-2"
                        >
                          {reward.redeemed ? "Redeemed" : "Redeem"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
} 