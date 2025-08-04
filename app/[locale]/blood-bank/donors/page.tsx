"use client"

import { useI18n } from "@/lib/i18n/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Mail, Phone, Calendar, Heart } from "lucide-react"

export default function DonorsPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  // Mock data for donors
  const donors = [
    {
      id: "D001",
      name: "Alice Johnson",
      bloodType: "O+",
      lastDonation: "2024-02-15",
      nextEligible: "2024-05-15",
      status: "Active",
      totalDonations: 5,
      contact: {
        email: "alice.j@email.com",
        phone: "+1 234-567-8901"
      }
    },
    {
      id: "D002",
      name: "Bob Smith",
      bloodType: "A-",
      lastDonation: "2024-01-20",
      nextEligible: "2024-04-20",
      status: "Active",
      totalDonations: 3,
      contact: {
        email: "bob.s@email.com",
        phone: "+1 234-567-8902"
      }
    },
    {
      id: "D003",
      name: "Carol White",
      bloodType: "B+",
      lastDonation: "2024-03-01",
      nextEligible: "2024-06-01",
      status: "Inactive",
      totalDonations: 2,
      contact: {
        email: "carol.w@email.com",
        phone: "+1 234-567-8903"
      }
    }
  ]

  // Mock data for donation history
  const donationHistory = [
    {
      id: "DH001",
      donorId: "D001",
      donorName: "Alice Johnson",
      date: "2024-02-15",
      bloodType: "O+",
      volume: "450ml",
      status: "Completed",
      location: "Main Center"
    },
    {
      id: "DH002",
      donorId: "D002",
      donorName: "Bob Smith",
      date: "2024-01-20",
      bloodType: "A-",
      volume: "450ml",
      status: "Completed",
      location: "Mobile Unit"
    },
    {
      id: "DH003",
      donorId: "D003",
      donorName: "Carol White",
      date: "2024-03-01",
      bloodType: "B+",
      volume: "450ml",
      status: "Completed",
      location: "Main Center"
    }
  ]

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Donor Management</h1>
              <p className="text-muted-foreground">Manage donor relationships and communication</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Donor
            </Button>
          </div>

          <Tabs defaultValue="donors" className="space-y-4">
            <TabsList>
              <TabsTrigger value="donors">Donor Directory</TabsTrigger>
              <TabsTrigger value="history">Donation History</TabsTrigger>
            </TabsList>

            <TabsContent value="donors" className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search donors..."
                    className="w-full pl-8"
                  />
                </div>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Blood Types</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Donors Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Donor Directory</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Blood Type</TableHead>
                        <TableHead>Last Donation</TableHead>
                        <TableHead>Next Eligible</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Donations</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donors.map((donor) => (
                        <TableRow key={donor.id}>
                          <TableCell>{donor.id}</TableCell>
                          <TableCell>{donor.name}</TableCell>
                          <TableCell>{donor.bloodType}</TableCell>
                          <TableCell>{donor.lastDonation}</TableCell>
                          <TableCell>{donor.nextEligible}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                donor.status === "Active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {donor.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{donor.totalDonations}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon">
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Phone className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              View Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Donation History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Donor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Blood Type</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donationHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.id}</TableCell>
                          <TableCell>{record.donorName}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.bloodType}</TableCell>
                          <TableCell>{record.volume}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.status}</Badge>
                          </TableCell>
                          <TableCell>{record.location}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
} 