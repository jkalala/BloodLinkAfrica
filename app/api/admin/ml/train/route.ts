/**
 * ML Training API Endpoint
 * Allows admin users to train and manage machine learning models
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { handleError, createErrorResponse, AuthenticationError, AuthorizationError } from '@/lib/error-handling'
import { performanceMonitor } from '@/lib/performance-monitoring'
import { aiMatchingService } from '@/lib/ai-matching-service'

export async function POST(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/ml/train', 'POST')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { force = false, models = ['all'] } = body

    console.log(`🎓 Starting ML training for models: ${models.join(', ')}`)

    // Log training start
    const { data: trainingLog } = await supabase
      .from('ml_training_logs')
      .insert([{
        model_type: models.join(','),
        training_start: new Date().toISOString(),
        status: 'running',
        data_count: 0
      }])
      .select()
      .single()

    try {
      // Check if models need retraining
      if (!force) {
        const { data: existingModels } = await supabase
          .from('ml_models')
          .select('*')
          .eq('status', 'active')

        const recentModels = existingModels?.filter(model => {
          const lastTrained = new Date(model.last_trained)
          const daysSince = (Date.now() - lastTrained.getTime()) / (1000 * 60 * 60 * 24)
          return daysSince < 7 // Trained within last 7 days
        })

        if (recentModels && recentModels.length > 0 && models.includes('all')) {
          return NextResponse.json({
            success: true,
            message: 'Models are recently trained. Use force=true to retrain.',
            data: {
              recentModels: recentModels.map(m => ({
                type: m.type,
                accuracy: m.accuracy,
                lastTrained: m.last_trained,
                trainingDataCount: m.training_data_count
              }))
            }
          })
        }
      }

      // Get training data count
      const { count: dataCount } = await supabase
        .from('blood_requests')
        .select('*', { count: 'exact' })
        .not('status', 'eq', 'pending')

      if (!dataCount || dataCount < 50) {
        throw new Error(`Insufficient training data. Need at least 50 completed requests, found ${dataCount}`)
      }

      // Update training log with data count
      await supabase
        .from('ml_training_logs')
        .update({ data_count: dataCount })
        .eq('id', trainingLog?.id)

      // Train models
      const trainingResult = await aiMatchingService.trainModels()

      if (!trainingResult.success) {
        throw new Error('ML training failed')
      }

      // Update donor profiles with ML insights
      console.log('🔄 Updating donor profiles...')
      await aiMatchingService.updateAllDonorProfiles()

      // Update training log
      await supabase
        .from('ml_training_logs')
        .update({
          training_end: new Date().toISOString(),
          status: 'completed',
          accuracy: trainingResult.accuracy.donor_matching || 0,
          metrics: trainingResult.accuracy
        })
        .eq('id', trainingLog?.id)

      const response = {
        success: true,
        message: 'ML models trained successfully',
        data: {
          trainingId: trainingLog?.id,
          modelsCount: trainingResult.models.length,
          accuracy: trainingResult.accuracy,
          dataCount,
          trainedAt: new Date().toISOString()
        }
      }

      console.log('✅ ML training completed successfully')
      tracker.end(200)
      return NextResponse.json(response)

    } catch (trainingError: any) {
      // Update training log with error
      await supabase
        .from('ml_training_logs')
        .update({
          training_end: new Date().toISOString(),
          status: 'failed',
          error_message: trainingError.message
        })
        .eq('id', trainingLog?.id)

      throw trainingError
    }

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}

export async function GET(request: NextRequest) {
  const tracker = performanceMonitor.startTracking('/api/admin/ml/train', 'GET')

  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw AuthenticationError('Authentication required')
    }

    // Verify admin permissions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      throw AuthorizationError('Admin access required')
    }

    // Get training history
    const { data: trainingLogs } = await supabase
      .from('ml_training_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    // Get current model status
    const { data: currentModels } = await supabase
      .from('ml_models')
      .select('*')
      .eq('status', 'active')

    // Get performance analysis
    const performanceAnalysis = await aiMatchingService.analyzeMatchingPerformance()

    // Get model metrics
    const modelMetrics = aiMatchingService.getModelMetrics()

    const response = {
      success: true,
      data: {
        trainingHistory: trainingLogs || [],
        currentModels: currentModels || [],
        performance: performanceAnalysis,
        metrics: modelMetrics,
        recommendations: performanceAnalysis.recommendations
      }
    }

    tracker.end(200)
    return NextResponse.json(response)

  } catch (error) {
    const appError = handleError(error)
    tracker.end(appError.statusCode)
    return createErrorResponse(appError)
  }
}