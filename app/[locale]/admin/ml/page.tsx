import { Metadata } from 'next'
import { MLDashboard } from '@/components/ml-dashboard'

export const metadata: Metadata = {
  title: 'Machine Learning Dashboard | BloodConnect Admin',
  description: 'Monitor and manage AI/ML models for donor matching and predictions',
}

export default function MLDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MLDashboard />
    </div>
  )
}