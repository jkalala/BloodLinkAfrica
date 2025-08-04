/**
 * WebSocket Server Infrastructure
 * 
 * Production-ready WebSocket server with connection management,
 * room-based messaging, authentication, and scalability features
 */

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'url'
import { getAuthManager } from '../security/auth-manager'
import { performanceMonitor } from '../performance/metrics'
import { getCache } from '../cache/redis-cache'

export interface WebSocketConnection {
  id: string
  socket: WebSocket
  userId: string
  userRole: string
  rooms: Set<string>
  lastActivity: Date
  metadata: {
    userAgent?: string
    ipAddress?: string
    connectionTime: Date
    messageCount: number
  }
}

export interface WebSocketMessage {
  type: string
  room?: string
  data: any
  timestamp: Date
  messageId: string
  userId?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface WebSocketRoom {
  id: string
  name: string
  type: 'blood_request' | 'emergency' | 'hospital' | 'region' | 'admin' | 'general'
  connections: Set<string>
  metadata: {
    createdAt: Date
    lastActivity: Date
    messageCount: number
    maxConnections: number
  }
  permissions: {
    canJoin: string[]
    canSend: string[]
    canModerate: string[]
  }
}

class WebSocketServerManager {
  private wss: WebSocketServer | null = null
  private connections: Map<string, WebSocketConnection> = new Map()
  private rooms: Map<string, WebSocketRoom> = new Map()
  private cache = getCache()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  // Configuration
  private readonly CONFIG = {
    port: parseInt(process.env.WEBSOCKET_PORT || '8080'),
    maxConnections: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS || '10000'),
    heartbeatInterval: 30000, // 30 seconds
    connectionTimeout: 60000, // 1 minute
    messageRateLimit: 100, // messages per minute
    maxRoomsPerUser: 50,
    cleanupInterval: 300000 // 5 minutes
  }

  // Message types
  private readonly MESSAGE_TYPES = {
    // Connection management
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    HEARTBEAT: 'heartbeat',
    
    // Room management
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    ROOM_MESSAGE: 'room_message',
    
    // Blood donation events
    BLOOD_REQUEST_CREATED: 'blood_request_created',
    BLOOD_REQUEST_UPDATED: 'blood_request_updated',
    DONOR_MATCHED: 'donor_matched',
    DONATION_SCHEDULED: 'donation_scheduled',
    EMERGENCY_ALERT: 'emergency_alert',
    
    // System events
    SYSTEM_NOTIFICATION: 'system_notification',
    USER_STATUS_CHANGE: 'user_status_change',
    ANALYTICS_UPDATE: 'analytics_update'
  }

  constructor() {
    this.initializeServer()
    this.setupDefaultRooms()
    this.startHeartbeat()
    this.startCleanup()
  }

  private initializeServer(): void {
    try {
      this.wss = new WebSocketServer({
        port: this.CONFIG.port,
        verifyClient: this.verifyClient.bind(this)
      })

      this.wss.on('connection', this.handleConnection.bind(this))
      this.wss.on('error', this.handleServerError.bind(this))

      console.log(`WebSocket server started on port ${this.CONFIG.port}`)

    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error)
      throw error
    }
  }

  private async verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): Promise<boolean> {
    try {
      // Parse query parameters for authentication
      const url = parse(info.req.url || '', true)
      const token = url.query.token as string

      if (!token) {
        return false
      }

      // Verify authentication token
      const authManager = getAuthManager()
      const user = await authManager.verifyToken(token)

      if (!user) {
        return false
      }

      // Check connection limits
      if (this.connections.size >= this.CONFIG.maxConnections) {
        console.warn('WebSocket connection limit reached')
        return false
      }

      // Store user info for connection handler
      ;(info.req as any).user = user

      return true

    } catch (error) {
      console.error('WebSocket client verification failed:', error)
      return false
    }
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    try {
      const user = (request as any).user
      const connectionId = this.generateConnectionId()
      
      const connection: WebSocketConnection = {
        id: connectionId,
        socket,
        userId: user.id,
        userRole: user.role,
        rooms: new Set(),
        lastActivity: new Date(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ipAddress: request.headers['x-forwarded-for'] as string || request.socket.remoteAddress,
          connectionTime: new Date(),
          messageCount: 0
        }
      }

      this.connections.set(connectionId, connection)

      // Set up socket event handlers
      socket.on('message', (data) => this.handleMessage(connectionId, data))
      socket.on('close', () => this.handleDisconnection(connectionId))
      socket.on('error', (error) => this.handleSocketError(connectionId, error))
      socket.on('pong', () => this.handlePong(connectionId))

      // Auto-join user to relevant rooms
      this.autoJoinRooms(connection)

      // Send connection confirmation
      this.sendToConnection(connectionId, {
        type: this.MESSAGE_TYPES.CONNECT,
        data: {
          connectionId,
          serverTime: new Date(),
          availableRooms: this.getAvailableRooms(user.role)
        },
        timestamp: new Date(),
        messageId: this.generateMessageId()
      })

      // Record connection metrics
      performanceMonitor.recordCustomMetric({
        name: 'websocket_connection_established',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: {
          user_role: user.role,
          total_connections: this.connections.size.toString()
        }
      })

      console.log(`WebSocket connection established: ${connectionId} (User: ${user.id})`)

    } catch (error) {
      console.error('Error handling WebSocket connection:', error)
      socket.close()
    }
  }

  private async handleMessage(connectionId: string, data: Buffer): Promise<void> {
    try {
      const connection = this.connections.get(connectionId)
      if (!connection) return

      // Parse message
      const message = JSON.parse(data.toString())
      
      // Update connection activity
      connection.lastActivity = new Date()
      connection.metadata.messageCount++

      // Rate limiting check
      if (await this.isRateLimited(connectionId)) {
        this.sendError(connectionId, 'Rate limit exceeded')
        return
      }

      // Handle different message types
      switch (message.type) {
        case this.MESSAGE_TYPES.JOIN_ROOM:
          await this.handleJoinRoom(connectionId, message.data.roomId)
          break

        case this.MESSAGE_TYPES.LEAVE_ROOM:
          await this.handleLeaveRoom(connectionId, message.data.roomId)
          break

        case this.MESSAGE_TYPES.ROOM_MESSAGE:
          await this.handleRoomMessage(connectionId, message)
          break

        case this.MESSAGE_TYPES.HEARTBEAT:
          this.handleHeartbeat(connectionId)
          break

        default:
          console.warn(`Unknown message type: ${message.type}`)
      }

    } catch (error) {
      console.error('Error handling WebSocket message:', error)
      this.sendError(connectionId, 'Invalid message format')
    }
  }

  private handleDisconnection(connectionId: string): void {
    try {
      const connection = this.connections.get(connectionId)
      if (!connection) return

      // Leave all rooms
      for (const roomId of connection.rooms) {
        this.leaveRoom(connectionId, roomId)
      }

      // Remove connection
      this.connections.delete(connectionId)

      // Record disconnection metrics
      performanceMonitor.recordCustomMetric({
        name: 'websocket_connection_closed',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: {
          user_role: connection.userRole,
          session_duration: (Date.now() - connection.metadata.connectionTime.getTime()).toString(),
          message_count: connection.metadata.messageCount.toString()
        }
      })

      console.log(`WebSocket connection closed: ${connectionId}`)

    } catch (error) {
      console.error('Error handling WebSocket disconnection:', error)
    }
  }

  private handleSocketError(connectionId: string, error: Error): void {
    console.error(`WebSocket error for connection ${connectionId}:`, error)
    
    performanceMonitor.recordCustomMetric({
      name: 'websocket_error',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        connection_id: connectionId,
        error_type: error.name
      }
    })
  }

  private handleServerError(error: Error): void {
    console.error('WebSocket server error:', error)
    
    performanceMonitor.recordCustomMetric({
      name: 'websocket_server_error',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        error_type: error.name
      }
    })
  }

  private async handleJoinRoom(connectionId: string, roomId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const room = this.rooms.get(roomId)
    if (!room) {
      this.sendError(connectionId, `Room ${roomId} not found`)
      return
    }

    // Check permissions
    if (!this.canJoinRoom(connection, room)) {
      this.sendError(connectionId, `Insufficient permissions to join room ${roomId}`)
      return
    }

    // Check room limits
    if (connection.rooms.size >= this.CONFIG.maxRoomsPerUser) {
      this.sendError(connectionId, 'Maximum rooms per user exceeded')
      return
    }

    this.joinRoom(connectionId, roomId)
  }

  private async handleLeaveRoom(connectionId: string, roomId: string): Promise<void> {
    this.leaveRoom(connectionId, roomId)
  }

  private async handleRoomMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const roomId = message.room
    const room = this.rooms.get(roomId)
    
    if (!room || !connection.rooms.has(roomId)) {
      this.sendError(connectionId, 'Not in specified room')
      return
    }

    // Check send permissions
    if (!this.canSendToRoom(connection, room)) {
      this.sendError(connectionId, 'Insufficient permissions to send to room')
      return
    }

    // Broadcast message to room
    this.broadcastToRoom(roomId, {
      type: this.MESSAGE_TYPES.ROOM_MESSAGE,
      room: roomId,
      data: message.data,
      timestamp: new Date(),
      messageId: this.generateMessageId(),
      userId: connection.userId
    })
  }

  private handleHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    connection.lastActivity = new Date()
    
    this.sendToConnection(connectionId, {
      type: this.MESSAGE_TYPES.HEARTBEAT,
      data: { serverTime: new Date() },
      timestamp: new Date(),
      messageId: this.generateMessageId()
    })
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.lastActivity = new Date()
    }
  }

  // Room management methods
  private joinRoom(connectionId: string, roomId: string): void {
    const connection = this.connections.get(connectionId)
    const room = this.rooms.get(roomId)
    
    if (!connection || !room) return

    connection.rooms.add(roomId)
    room.connections.add(connectionId)
    room.metadata.lastActivity = new Date()

    this.sendToConnection(connectionId, {
      type: this.MESSAGE_TYPES.JOIN_ROOM,
      data: { roomId, joined: true },
      timestamp: new Date(),
      messageId: this.generateMessageId()
    })

    console.log(`Connection ${connectionId} joined room ${roomId}`)
  }

  private leaveRoom(connectionId: string, roomId: string): void {
    const connection = this.connections.get(connectionId)
    const room = this.rooms.get(roomId)
    
    if (!connection || !room) return

    connection.rooms.delete(roomId)
    room.connections.delete(connectionId)

    this.sendToConnection(connectionId, {
      type: this.MESSAGE_TYPES.LEAVE_ROOM,
      data: { roomId, left: true },
      timestamp: new Date(),
      messageId: this.generateMessageId()
    })

    console.log(`Connection ${connectionId} left room ${roomId}`)
  }

  // Broadcasting methods
  public broadcastToRoom(roomId: string, message: WebSocketMessage): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.metadata.messageCount++
    room.metadata.lastActivity = new Date()

    for (const connectionId of room.connections) {
      this.sendToConnection(connectionId, message)
    }
  }

  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        this.sendToConnection(connection.id, message)
      }
    }
  }

  public broadcastToRole(role: string, message: WebSocketMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.userRole === role) {
        this.sendToConnection(connection.id, message)
      }
    }
  }

  public broadcastGlobal(message: WebSocketMessage): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, message)
    }
  }

  private sendToConnection(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId)
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      connection.socket.send(JSON.stringify(message))
    } catch (error) {
      console.error(`Failed to send message to connection ${connectionId}:`, error)
      this.handleDisconnection(connectionId)
    }
  }

  private sendError(connectionId: string, error: string): void {
    this.sendToConnection(connectionId, {
      type: 'error',
      data: { error },
      timestamp: new Date(),
      messageId: this.generateMessageId()
    })
  }

  // Permission and validation methods
  private canJoinRoom(connection: WebSocketConnection, room: WebSocketRoom): boolean {
    return room.permissions.canJoin.includes(connection.userRole) || 
           room.permissions.canJoin.includes('all')
  }

  private canSendToRoom(connection: WebSocketConnection, room: WebSocketRoom): boolean {
    return room.permissions.canSend.includes(connection.userRole) || 
           room.permissions.canSend.includes('all')
  }

  private async isRateLimited(connectionId: string): Promise<boolean> {
    const key = `websocket_rate_limit:${connectionId}`
    const current = await this.cache.get<number>(key) || 0
    
    if (current >= this.CONFIG.messageRateLimit) {
      return true
    }

    await this.cache.set(key, current + 1, { ttl: 60 }) // 1 minute window
    return false
  }

  // Setup and utility methods
  private setupDefaultRooms(): void {
    const defaultRooms: Omit<WebSocketRoom, 'connections' | 'metadata'>[] = [
      {
        id: 'emergency',
        name: 'Emergency Alerts',
        type: 'emergency',
        permissions: {
          canJoin: ['all'],
          canSend: ['admin', 'super_admin', 'hospital'],
          canModerate: ['admin', 'super_admin']
        }
      },
      {
        id: 'general',
        name: 'General Notifications',
        type: 'general',
        permissions: {
          canJoin: ['all'],
          canSend: ['admin', 'super_admin'],
          canModerate: ['admin', 'super_admin']
        }
      },
      {
        id: 'admin',
        name: 'Admin Channel',
        type: 'admin',
        permissions: {
          canJoin: ['admin', 'super_admin'],
          canSend: ['admin', 'super_admin'],
          canModerate: ['super_admin']
        }
      }
    ]

    for (const roomData of defaultRooms) {
      this.rooms.set(roomData.id, {
        ...roomData,
        connections: new Set(),
        metadata: {
          createdAt: new Date(),
          lastActivity: new Date(),
          messageCount: 0,
          maxConnections: 1000
        }
      })
    }
  }

  private autoJoinRooms(connection: WebSocketConnection): void {
    // Auto-join based on user role
    const autoJoinRooms = ['general']
    
    if (['admin', 'super_admin'].includes(connection.userRole)) {
      autoJoinRooms.push('admin')
    }

    if (['hospital', 'admin', 'super_admin'].includes(connection.userRole)) {
      autoJoinRooms.push('emergency')
    }

    for (const roomId of autoJoinRooms) {
      this.joinRoom(connection.id, roomId)
    }
  }

  private getAvailableRooms(userRole: string): string[] {
    const availableRooms: string[] = []
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (this.canJoinRoom({ userRole } as WebSocketConnection, room)) {
        availableRooms.push(roomId)
      }
    }

    return availableRooms
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections.entries()) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.ping()
        } else {
          this.handleDisconnection(connectionId)
        }
      }
    }, this.CONFIG.heartbeatInterval)
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date()
      const timeout = this.CONFIG.connectionTimeout

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastActivity.getTime() > timeout) {
          console.log(`Cleaning up inactive connection: ${connectionId}`)
          this.handleDisconnection(connectionId)
        }
      }
    }, this.CONFIG.cleanupInterval)
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Public API methods
  public createRoom(roomData: Omit<WebSocketRoom, 'connections' | 'metadata'>): void {
    this.rooms.set(roomData.id, {
      ...roomData,
      connections: new Set(),
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        maxConnections: 1000
      }
    })
  }

  public deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    // Disconnect all users from room
    for (const connectionId of room.connections) {
      this.leaveRoom(connectionId, roomId)
    }

    this.rooms.delete(roomId)
  }

  public getStats() {
    return {
      connections: this.connections.size,
      rooms: this.rooms.size,
      totalMessages: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.metadata.messageCount, 0),
      uptime: process.uptime()
    }
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    for (const connection of this.connections.values()) {
      connection.socket.close()
    }

    if (this.wss) {
      this.wss.close()
    }

    console.log('WebSocket server shut down')
  }
}

// Singleton instance
let webSocketServerInstance: WebSocketServerManager | null = null

export function getWebSocketServer(): WebSocketServerManager {
  if (!webSocketServerInstance) {
    webSocketServerInstance = new WebSocketServerManager()
  }
  return webSocketServerInstance
}

export default WebSocketServerManager
