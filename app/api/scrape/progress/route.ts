import { NextRequest } from "next/server"

// Global progress tracking
let progressClients: Set<WritableStreamDefaultWriter> = new Set()
let currentProgress: {
  isRunning: boolean
  outlets: Record<string, {
    status: 'idle' | 'running' | 'completed' | 'error'
    progress: number
    articlesFound: number
    message: string
    startTime?: number
    endTime?: number
    error?: string
  }>
  overall: {
    progress: number
    message: string
    startTime?: number
    endTime?: number
  }
} = {
  isRunning: false,
  outlets: {
    hkfp: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
    singtao: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
    hk01: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
    oncc: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
  },
  overall: {
    progress: 0,
    message: 'Ready to scrape'
  }
}

// Progress update functions
export function updateProgress(outlet: string, data: Partial<typeof currentProgress.outlets[string]>) {
  if (currentProgress.outlets[outlet]) {
    currentProgress.outlets[outlet] = { ...currentProgress.outlets[outlet], ...data }
    
    // Calculate overall progress
    const outlets = Object.values(currentProgress.outlets)
    const totalProgress = outlets.reduce((sum, outlet) => sum + outlet.progress, 0)
    currentProgress.overall.progress = Math.round(totalProgress / outlets.length)
    
    const runningCount = outlets.filter(o => o.status === 'running').length
    const completedCount = outlets.filter(o => o.status === 'completed').length
    const errorCount = outlets.filter(o => o.status === 'error').length
    
    if (runningCount > 0) {
      currentProgress.overall.message = `Scraping ${runningCount} outlet${runningCount > 1 ? 's' : ''}...`
    } else if (completedCount + errorCount === outlets.length) {
      currentProgress.overall.message = `Completed: ${completedCount} successful, ${errorCount} failed`
      currentProgress.isRunning = false
      currentProgress.overall.endTime = Date.now()
    }
    
    broadcastProgress()
  }
}

export function startScraping(outlets?: string[]) {
  const targetOutlets = outlets || Object.keys(currentProgress.outlets)
  
  currentProgress.isRunning = true
  currentProgress.overall.startTime = Date.now()
  currentProgress.overall.endTime = undefined
  currentProgress.overall.message = 'Starting scrape...'
  
  // Reset target outlets
  targetOutlets.forEach(outlet => {
    if (currentProgress.outlets[outlet]) {
      currentProgress.outlets[outlet] = {
        status: 'idle',
        progress: 0,
        articlesFound: 0,
        message: 'Preparing...',
        startTime: Date.now()
      }
    }
  })
  
  broadcastProgress()
}

export function getProgress() {
  return currentProgress
}

function broadcastProgress() {
  const message = JSON.stringify({
    type: 'progress',
    data: currentProgress,
    timestamp: Date.now()
  })
  
  progressClients.forEach(writer => {
    try {
      writer.write(new TextEncoder().encode(`data: ${message}\n\n`))
    } catch (error) {
      progressClients.delete(writer)
    }
  })
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const writer = controller
      
      // Add client to set
      const writerProxy = {
        write: (chunk: Uint8Array) => {
          try {
            controller.enqueue(chunk)
          } catch (error) {
            console.error('SSE write error:', error)
          }
        }
      }
      
      progressClients.add(writerProxy as any)
      
      // Send initial state
      const initialMessage = JSON.stringify({
        type: 'initial',
        data: currentProgress,
        timestamp: Date.now()
      })
      
      try {
        controller.enqueue(new TextEncoder().encode(`data: ${initialMessage}\n\n`))
      } catch (error) {
        console.error('SSE initial message error:', error)
      }
      
      // Handle cleanup
      request.signal.addEventListener('abort', () => {
        progressClients.delete(writerProxy as any)
        try {
          controller.close()
        } catch (error) {
          // Controller might already be closed
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, outlet, data } = body
    
    switch (action) {
      case 'update':
        if (outlet && data) {
          updateProgress(outlet, data)
        }
        break
        
      case 'start':
        startScraping(data?.outlets)
        break
        
      case 'reset':
        // Reset all progress
        Object.keys(currentProgress.outlets).forEach(outlet => {
          currentProgress.outlets[outlet] = {
            status: 'idle',
            progress: 0,
            articlesFound: 0,
            message: 'Ready'
          }
        })
        currentProgress.overall = {
          progress: 0,
          message: 'Ready to scrape'
        }
        currentProgress.isRunning = false
        broadcastProgress()
        break
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 })
    }
    
    return Response.json({ success: true, progress: currentProgress })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}