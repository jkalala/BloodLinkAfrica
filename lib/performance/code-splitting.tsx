/**
 * Advanced Code Splitting and Lazy Loading System
 * 
 * Intelligent component loading with preloading, error boundaries,
 * and performance monitoring
 */

import React, { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react'
import { performanceMonitor } from './metrics'

export interface LazyLoadOptions {
  fallback?: React.ComponentType
  preload?: boolean
  retryCount?: number
  timeout?: number
  chunkName?: string
  onError?: (error: Error) => void
  onLoad?: (component: ComponentType<any>) => void
}

export interface PreloadableComponent<T = {}> extends LazyExoticComponent<ComponentType<T>> {
  preload: () => Promise<{ default: ComponentType<T> }>
}

// Enhanced loading fallback component
const DefaultLoadingFallback: React.FC<{ 
  componentName?: string 
  timeout?: boolean 
}> = ({ componentName, timeout }) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <div className="text-sm text-muted-foreground">
        {timeout 
          ? `Loading ${componentName || 'component'} is taking longer than expected...`
          : `Loading ${componentName || 'component'}...`
        }
      </div>
    </div>
  </div>
)

// Error boundary for lazy-loaded components
class LazyLoadErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>
    onError?: (error: Error) => void
    componentName?: string
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo)
    
    // Track error in performance monitoring
    performanceMonitor.recordCustomMetric({
      name: 'lazy_load_error',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        component: this.props.componentName || 'unknown',
        error: error.message,
        type: 'error'
      }
    })

    this.props.onError?.(error)
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const DefaultErrorFallback = () => (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Failed to load component</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {this.props.componentName || 'Component'} failed to load. Please try again.
          </p>
          <button
            onClick={this.retry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      )

      const ErrorFallback = this.props.fallback || DefaultErrorFallback
      return <ErrorFallback error={this.state.error!} retry={this.retry} />
    }

    return this.props.children
  }
}

// Advanced lazy loading with retry mechanism
function createLazyComponent<T = {}>(
  importFunction: () => Promise<{ default: ComponentType<T> }>,
  options: LazyLoadOptions = {}
): PreloadableComponent<T> {
  const {
    retryCount = 3,
    timeout = 10000,
    chunkName,
    onError,
    onLoad
  } = options

  let retries = 0
  let loadPromise: Promise<{ default: ComponentType<T> }> | null = null

  const loadWithRetry = async (): Promise<{ default: ComponentType<T> }> => {
    const startTime = performance.now()

    try {
      // Add timeout to import
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Component load timeout')), timeout)
      })

      const result = await Promise.race([importFunction(), timeoutPromise])
      
      const loadTime = performance.now() - startTime
      
      // Track successful load
      performanceMonitor.recordCustomMetric({
        name: 'lazy_load_success',
        value: loadTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          component: chunkName || 'unknown',
          retries: retries.toString(),
          type: 'load'
        }
      })

      onLoad?.(result.default)
      retries = 0 // Reset retry count on success
      
      return result
    } catch (error) {
      const loadTime = performance.now() - startTime
      
      // Track failed load
      performanceMonitor.recordCustomMetric({
        name: 'lazy_load_failure',
        value: loadTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          component: chunkName || 'unknown',
          retries: retries.toString(),
          error: (error as Error).message,
          type: 'error'
        }
      })

      if (retries < retryCount) {
        retries++
        console.warn(`Retrying component load (${retries}/${retryCount}):`, error)
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        
        return loadWithRetry()
      }

      onError?.(error as Error)
      throw error
    }
  }

  const LazyComponent = lazy(() => {
    if (!loadPromise) {
      loadPromise = loadWithRetry()
    }
    return loadPromise
  }) as PreloadableComponent<T>

  // Add preload method
  LazyComponent.preload = () => {
    if (!loadPromise) {
      loadPromise = loadWithRetry()
    }
    return loadPromise
  }

  return LazyComponent
}

// HOC for wrapping lazy components with error boundary and loading states
export function withLazyLoading<T = {}>(
  LazyComponent: PreloadableComponent<T>,
  options: LazyLoadOptions = {}
): React.FC<T> {
  const {
    fallback: CustomFallback,
    chunkName,
    onError
  } = options

  return function LazyWrapper(props: T) {
    const [isTimeout, setIsTimeout] = React.useState(false)
    const [isVisible, setIsVisible] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    // Intersection Observer for viewport-based loading
    React.useEffect(() => {
      if (!ref.current) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            LazyComponent.preload()
            observer.disconnect()
          }
        },
        { threshold: 0.1 }
      )

      observer.observe(ref.current)

      return () => observer.disconnect()
    }, [])

    // Timeout detection
    React.useEffect(() => {
      const timer = setTimeout(() => {
        setIsTimeout(true)
      }, options.timeout || 10000)

      return () => clearTimeout(timer)
    }, [])

    const LoadingFallback = CustomFallback || (() => (
      <DefaultLoadingFallback componentName={chunkName} timeout={isTimeout} />
    ))

    return (
      <div ref={ref}>
        <LazyLoadErrorBoundary
          componentName={chunkName}
          onError={onError}
        >
          <Suspense fallback={<LoadingFallback />}>
            {isVisible && <LazyComponent {...props} />}
          </Suspense>
        </LazyLoadErrorBoundary>
      </div>
    )
  }
}

// Preload components based on user interaction patterns
export class ComponentPreloader {
  private static preloadedComponents = new Set<string>()
  private static preloadQueue: Array<() => Promise<any>> = []
  private static isProcessing = false

  static preloadComponent(
    component: PreloadableComponent<any>,
    componentName: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    if (this.preloadedComponents.has(componentName)) {
      return
    }

    const preloadFunction = async () => {
      try {
        await component.preload()
        this.preloadedComponents.add(componentName)
        
        performanceMonitor.recordCustomMetric({
          name: 'component_preload_success',
          value: 1,
          unit: 'count',
          timestamp: Date.now(),
          tags: {
            component: componentName,
            priority,
            type: 'preload'
          }
        })
      } catch (error) {
        console.error(`Failed to preload component ${componentName}:`, error)
        
        performanceMonitor.recordCustomMetric({
          name: 'component_preload_failure',
          value: 1,
          unit: 'count',
          timestamp: Date.now(),
          tags: {
            component: componentName,
            priority,
            error: (error as Error).message,
            type: 'error'
          }
        })
      }
    }

    // Add to queue based on priority
    if (priority === 'high') {
      this.preloadQueue.unshift(preloadFunction)
    } else {
      this.preloadQueue.push(preloadFunction)
    }

    this.processQueue()
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.preloadQueue.length > 0) {
      const preloadFunction = this.preloadQueue.shift()
      if (preloadFunction) {
        await preloadFunction()
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    this.isProcessing = false
  }

  static preloadOnHover(
    element: HTMLElement,
    component: PreloadableComponent<any>,
    componentName: string
  ): () => void {
    let timeoutId: NodeJS.Timeout

    const handleMouseEnter = () => {
      timeoutId = setTimeout(() => {
        this.preloadComponent(component, componentName, 'high')
      }, 200) // Delay to avoid accidental hovers
    }

    const handleMouseLeave = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  static preloadOnIdle(
    components: Array<{
      component: PreloadableComponent<any>
      name: string
      priority?: 'high' | 'medium' | 'low'
    }>
  ): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        components.forEach(({ component, name, priority }) => {
          this.preloadComponent(component, name, priority)
        })
      })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        components.forEach(({ component, name, priority }) => {
          this.preloadComponent(component, name, priority)
        })
      }, 1000)
    }
  }
}

// Route-based code splitting helper
export function createRouteComponent<T = {}>(
  importFunction: () => Promise<{ default: ComponentType<T> }>,
  routeName: string
): PreloadableComponent<T> {
  return createLazyComponent(importFunction, {
    chunkName: `route-${routeName}`,
    preload: true,
    retryCount: 3,
    timeout: 15000,
    onLoad: () => {
      console.log(`Route component loaded: ${routeName}`)
    },
    onError: (error) => {
      console.error(`Failed to load route component ${routeName}:`, error)
    }
  })
}

// Bundle analyzer helper (development only)
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV === 'development') {
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      console.log('Bundle analysis available at http://localhost:8888')
    }).catch(() => {
      console.log('webpack-bundle-analyzer not available')
    })
  }
}

// Export utilities
export { createLazyComponent, DefaultLoadingFallback, LazyLoadErrorBoundary }
