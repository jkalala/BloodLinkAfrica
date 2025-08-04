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
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react"

export default function EquipmentPage() {
  const t = useI18n()
  const params = useParams()
  const locale = params.locale as string

  // Mock data for equipment
  const equipment = [
    {
      id: "E001",
      name: "Centrifuge A",
      type: "Blood Processing",
      status: "Operational",
      lastMaintenance: "2024-02-15",
      nextMaintenance: "2024-05-15",
      location: "Lab 1",
      health: 95
    },
    {
      id: "E002",
      name: "Storage Unit B",
      type: "Blood Storage",
      status: "Needs Maintenance",
      lastMaintenance: "2024-01-10",
      nextMaintenance: "2024-04-10",
      location: "Storage Room",
      health: 65
    },
    {
      id: "E003",
      name: "Testing Machine C",
      type: "Blood Testing",
      status: "Operational",
      lastMaintenance: "2024-03-01",
      nextMaintenance: "2024-06-01",
      location: "Lab 2",
      health: 88
    }
  ]

  // Mock data for maintenance history
  const maintenanceHistory = [
    {
      id: "M001",
      equipmentId: "E001",
      equipmentName: "Centrifuge A",
      date: "2024-02-15",
      type: "Routine",
      status: "Completed",
      technician: "John Smith",
      notes: "Regular maintenance performed"
    },
    {
      id: "M002",
      equipmentId: "E002",
      equipmentName: "Storage Unit B",
      date: "2024-01-10",
      type: "Emergency",
      status: "Completed",
      technician: "Sarah Johnson",
      notes: "Temperature sensor replaced"
    },
    {
      id: "M003",
      equipmentId: "E003",
      equipmentName: "Testing Machine C",
      date: "2024-03-01",
      type: "Routine",
      status: "Completed",
      technician: "Mike Brown",
      notes: "Calibration and cleaning"
    }
  ]

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white to-red-50 dark:from-gray-900 dark:to-gray-800">
      <MobileNav />
      <div className="flex-1 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Equipment Management</h1>
              <p className="text-muted-foreground">Track and maintain equipment status</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </div>

          <Tabs defaultValue="equipment" className="space-y-4">
            <TabsList>
              <TabsTrigger value="equipment">Equipment Status</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
            </TabsList>

            <TabsContent value="equipment" className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search equipment..."
                    className="w-full pl-8"
                  />
                </div>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="maintenance">Needs Maintenance</SelectItem>
                    <SelectItem value="repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Equipment Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Equipment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Last Maintenance</TableHead>
                        <TableHead>Next Maintenance</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipment.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "Operational"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={item.health} className="w-[60px]" />
                              <span className="text-sm">{item.health}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{item.lastMaintenance}</TableCell>
                          <TableCell>{item.nextMaintenance}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Schedule Maintenance
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Maintenance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.id}</TableCell>
                          <TableCell>{record.equipmentName}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.type === "Routine"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {record.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.status}</Badge>
                          </TableCell>
                          <TableCell>{record.technician}</TableCell>
                          <TableCell>{record.notes}</TableCell>
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