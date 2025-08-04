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
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Calendar as CalendarIcon, Clock } from "lucide-react"
import { useState } from "react"

export default function StaffPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string
  const [date, setDate] = useState<Date>()

  // Mock data for staff
  const staffMembers = [
    {
      id: "S001",
      name: "Dr. Sarah Johnson",
      role: "Medical Director",
      department: "Medical",
      status: "Active",
      schedule: "Full-time"
    },
    {
      id: "S002",
      name: "John Smith",
      role: "Lab Technician",
      department: "Laboratory",
      status: "Active",
      schedule: "Part-time"
    },
    {
      id: "S003",
      name: "Maria Garcia",
      role: "Nurse",
      department: "Donation",
      status: "On Leave",
      schedule: "Full-time"
    }
  ]

  // Mock data for shifts
  const shifts = [
    {
      id: "SH001",
      staffId: "S001",
      staffName: "Dr. Sarah Johnson",
      date: "2024-03-20",
      startTime: "09:00",
      endTime: "17:00",
      type: "Regular"
    },
    {
      id: "SH002",
      staffId: "S002",
      staffName: "John Smith",
      date: "2024-03-20",
      startTime: "13:00",
      endTime: "21:00",
      type: "Regular"
    },
    {
      id: "SH003",
      staffId: "S003",
      staffName: "Maria Garcia",
      date: "2024-03-21",
      startTime: "08:00",
      endTime: "16:00",
      type: "On Call"
    }
  ]

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Staff Management</h1>
              <p className="text-muted-foreground">Manage staff schedules and roles</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          </div>

          <Tabs defaultValue="staff" className="space-y-4">
            <TabsList>
              <TabsTrigger value="staff">Staff Directory</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    className="w-full pl-8"
                  />
                </div>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="laboratory">Laboratory</SelectItem>
                    <SelectItem value="donation">Donation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Staff Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Staff Directory</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffMembers.map((staff) => (
                        <TableRow key={staff.id}>
                          <TableCell>{staff.id}</TableCell>
                          <TableCell>{staff.name}</TableCell>
                          <TableCell>{staff.role}</TableCell>
                          <TableCell>{staff.department}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                staff.status === "Active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {staff.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{staff.schedule}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule Calendar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today's Shifts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {shifts
                        .filter((shift) => shift.date === "2024-03-20")
                        .map((shift) => (
                          <div
                            key={shift.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{shift.staffName}</p>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Clock className="h-4 w-4 mr-1" />
                                {shift.startTime} - {shift.endTime}
                              </div>
                            </div>
                            <Badge variant="outline">{shift.type}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
} 