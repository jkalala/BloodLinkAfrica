"use client"

import { ResponsiveLayout } from "@/components/responsive-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Heart, Award } from "lucide-react"
import { useParams } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function HistoryPage() {
  const params = useParams()
  const locale = params.locale as string

  // This would typically come from an API call
  const donationHistory = [
    {
      id: 1,
      date: "2024-03-15",
      location: "Central Blood Bank",
      bloodType: "O+",
      status: "Completed"
    },
    // Add more mock data as needed
  ]

  return (
    <ResponsiveLayout>
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Your Donation History</h1>
              <p className="text-muted-foreground">Your donation history will be displayed here.</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Donation History</CardTitle>
              <CardDescription>Track your past blood donations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Blood Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donationHistory.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>{donation.date}</TableCell>
                      <TableCell>{donation.location}</TableCell>
                      <TableCell>{donation.bloodType}</TableCell>
                      <TableCell>{donation.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  )
} 