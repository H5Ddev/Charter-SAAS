import { logger } from '../../../shared/utils/logger'

export interface InAppNotification {
  id: string
  title: string
  body: string
  entityType?: string
  entityId?: string
  link?: string
  createdAt: Date
}

/**
 * In-app notification sender via Socket.io.
 * The io instance is set during app initialisation.
 */
export class InAppSender {
  private io: import('socket.io').Server | null = null

  setIo(io: import('socket.io').Server): void {
    this.io = io
  }

  /**
   * Send an in-app notification to a specific user.
   */
  send(userId: string, notification: InAppNotification): void {
    if (!this.io) {
      logger.warn('InAppSender: Socket.io not initialised — notification not sent', {
        userId,
        notificationId: notification.id,
      })
      return
    }

    this.io.to(`user:${userId}`).emit('notification:new', notification)

    logger.debug(`In-app notification sent to user ${userId}`, {
      notificationId: notification.id,
      title: notification.title,
    })
  }

  /**
   * Broadcast a notification to all users in a tenant.
   */
  broadcast(tenantId: string, notification: InAppNotification): void {
    if (!this.io) {
      logger.warn('InAppSender: Socket.io not initialised — broadcast not sent')
      return
    }

    this.io.to(`tenant:${tenantId}`).emit('notification:new', notification)

    logger.debug(`In-app notification broadcast to tenant ${tenantId}`, {
      notificationId: notification.id,
    })
  }
}

export const inAppSender = new InAppSender()
