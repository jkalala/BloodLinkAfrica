import { Metadata } from 'next'
import { SecurityDashboard } from '@/components/security-dashboard'

export const metadata: Metadata = {
  title: 'Security Dashboard | BloodConnect Admin',
  description: 'Monitor and manage security events, threats, and system health',
}

export default function SecurityDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SecurityDashboard />
    </div>
  )
}