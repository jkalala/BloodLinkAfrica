'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Users,
  Activity
} from 'lucide-react'

interface MLModel {
  type: string
  accuracy: number
  lastTrained: string
  trainingDataCount: number
  version: number
  status: string
}

interface TrainingLog {
  id: string
  model_type: string
  training_start: string
  training_end?: string
  status: string
  accuracy?: number
  data_count: number
  error_message?: string
}

interface MLPerformance {
  totalPredictions: number
  averageAccuracy: number
  modelPerformance: Record<string, any>
  recommendations: string[]
}

export function MLDashboard() {
  const [models, setModels] = useState<MLModel[]>([])
  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([])
  const [performance, setPerformance] = useState<MLPerformance | null>(null)
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)

  useEffect(() => {
    loadMLData()
  }, [])

  const loadMLData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/ml/train')
      if (response.ok) {
        const data = await response.json()
        setModels(data.data.currentModels)
        setTrainingLogs(data.data.trainingHistory)
        setPerformance(data.data.performance)
      }
    } catch (error) {
      console.error('Error loading ML data:', error)
    } finally {
      setLoading(false)
    }
  }

  const startTraining = async (force = false) => {
    setTraining(true)
    try {
      const response = await fetch('/api/admin/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, models: ['all'] })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadMLData() // Refresh data
      } else {
        console.error('Training failed:', result.error)
      }
    } catch (error) {
      console.error('Error starting training:', error)
    } finally {
      setTraining(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'training': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.8) return 'text-green-600'
    if (accuracy >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'In progress...'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    return `${Math.round(duration / 1000)}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold">Machine Learning Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMLData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => startTraining(false)}
            disabled={training}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className={`h-4 w-4 mr-2 ${training ? 'animate-pulse' : ''}`} />
            {training ? 'Training...' : 'Train Models'}
          </Button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Models</p>
                <p className="text-2xl font-bold">{models.length}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Accuracy</p>
                <p className={`text-2xl font-bold ${performance ? getAccuracyColor(performance.averageAccuracy) : ''}`}>
                  {performance ? `${Math.round(performance.averageAccuracy * 100)}%` : '0%'}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Predictions</p>
                <p className="text-2xl font-bold">{performance?.totalPredictions || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Models</p>
                <p className="text-2xl font-bold text-green-600">
                  {models.filter(m => m.status === 'active').length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {performance?.recommendations && performance.recommendations.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ML Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {performance.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-500">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">Current Models</TabsTrigger>
          <TabsTrigger value="training">Training History</TabsTrigger>
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active ML Models</CardTitle>
              <CardDescription>
                Current machine learning models and their performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(model.status)}`} />
                      <div>
                        <h3 className="font-semibold capitalize">
                          {model.type.replace('_', ' ')} Model
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Last trained: {formatDate(model.lastTrained)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className={`font-semibold ${getAccuracyColor(model.accuracy)}`}>
                          {Math.round(model.accuracy * 100)}% Accuracy
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {model.trainingDataCount.toLocaleString()} samples
                        </p>
                      </div>
                      
                      <div className="w-20">
                        <Progress value={model.accuracy * 100} className="h-2" />
                      </div>
                      
                      <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                        v{model.version}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {models.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No trained models found</p>
                    <p className="text-sm">Start training to create your first ML model</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training History</CardTitle>
              <CardDescription>
                Recent ML model training sessions and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trainingLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {log.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                        {log.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                        {log.status === 'running' && <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />}
                        
                        <Badge variant={
                          log.status === 'completed' ? 'default' :
                          log.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {log.status}
                        </Badge>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold">
                          {log.model_type} Training
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Started: {formatDate(log.training_start)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold">
                        Duration: {formatDuration(log.training_start, log.training_end)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.data_count.toLocaleString()} samples
                      </p>
                      {log.accuracy && (
                        <p className={`text-sm ${getAccuracyColor(log.accuracy)}`}>
                          {Math.round(log.accuracy * 100)}% accuracy
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {trainingLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No training history found</p>
                    <p className="text-sm">Training logs will appear here after model training</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Individual model accuracy metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(performance?.modelPerformance || {}).map(([modelType, metrics]: [string, any]) => (
                    <div key={modelType} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">
                          {modelType.replace('_', ' ')}
                        </span>
                        <span className={`font-semibold ${getAccuracyColor(metrics.accuracy || 0)}`}>
                          {Math.round((metrics.accuracy || 0) * 100)}%
                        </span>
                      </div>
                      <Progress value={(metrics.accuracy || 0) * 100} className="h-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Last trained: {metrics.lastTrained ? formatDate(metrics.lastTrained) : 'Never'}</span>
                        <span>{(metrics.trainingDataCount || 0).toLocaleString()} samples</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prediction Analytics</CardTitle>
                <CardDescription>Real-world prediction performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Predictions Made</span>
                    <span className="font-semibold">{performance?.totalPredictions || 0}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Overall Accuracy</span>
                    <span className={`font-semibold ${performance ? getAccuracyColor(performance.averageAccuracy) : ''}`}>
                      {performance ? `${Math.round(performance.averageAccuracy * 100)}%` : '0%'}
                    </span>
                  </div>
                  
                  <div className="pt-4">
                    <h4 className="font-medium mb-2">Accuracy Breakdown</h4>
                    <Progress 
                      value={performance ? performance.averageAccuracy * 100 : 0} 
                      className="h-3" 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {performance && performance.totalPredictions < 100 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Limited data available. Accuracy will improve with more predictions.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}