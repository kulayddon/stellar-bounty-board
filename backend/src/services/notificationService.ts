/**
 * Notification Service - Bounty Lifecycle Updates
 * 
 * Provides hooks for notifying contributors and maintainers when bounty status changes.
 * Current implementation uses console/webhook stubs, designed for easy extension to email/SMS.
 * 
 * @module services/notificationService
 */

export type NotificationEventType =
  | 'bounty_created'
  | 'bounty_reserved'
  | 'bounty_submitted'
  | 'bounty_released'
  | 'bounty_refunded'
  | 'bounty_expired';

export interface NotificationPayload {
  eventType: NotificationEventType;
  bountyId: string;
  repo: string;
  issueNumber: number;
  title: string;
  status: string;
  maintainer?: string;
  contributor?: string;
  amount: number;
  tokenSymbol: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationRecipient {
  role: 'maintainer' | 'contributor';
  address: string;
}

export interface NotificationResult {
  success: boolean;
  recipient: NotificationRecipient;
  eventType: NotificationEventType;
  error?: string;
}

/**
 * Notification service interface
 */
export interface INotificationService {
  /**
   * Send notification to a recipient
   */
  notify(recipient: NotificationRecipient, payload: NotificationPayload): Promise<NotificationResult>;
  
  /**
   * Broadcast to multiple recipients
   */
  broadcast(recipients: NotificationRecipient[], payload: NotificationPayload): Promise<NotificationResult[]>;
}

/**
 * Console stub implementation - logs to stdout
 * Easy to replace with real email/SMS service later
 */
export class ConsoleNotificationService implements INotificationService {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  async notify(recipient: NotificationRecipient, payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.enabled) {
      return { success: false, recipient, eventType: payload.eventType, error: 'Notifications disabled' };
    }

    try {
      const emoji = this.getEventEmoji(payload.eventType);
      const roleLabel = recipient.role === 'maintainer' ? '👤 Maintainer' : '🛠️ Contributor';
      
      console.log('\n' + '='.repeat(60));
      console.log(`${emoji} BOUNTY NOTIFICATION: ${payload.eventType}`);
      console.log('='.repeat(60));
      console.log(`${roleLabel}: ${recipient.address}`);
      console.log(`Bounty: ${payload.bountyId} - ${payload.title}`);
      console.log(`Repo: ${payload.repo}#${payload.issueNumber}`);
      console.log(`Status: ${payload.status}`);
      console.log(`Amount: ${payload.amount} ${payload.tokenSymbol}`);
      console.log(`Time: ${new Date(payload.timestamp * 1000).toISOString()}`);
      console.log('='.repeat(60) + '\n');

      return { success: true, recipient, eventType: payload.eventType };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, recipient, eventType: payload.eventType, error: message };
    }
  }

  async broadcast(recipients: NotificationRecipient[], payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    for (const recipient of recipients) {
      const result = await this.notify(recipient, payload);
      results.push(result);
    }
    return results;
  }

  private getEventEmoji(eventType: NotificationEventType): string {
    const emojiMap: Record<NotificationEventType, string> = {
      bounty_created: '🎉',
      bounty_reserved: '🔒',
      bounty_submitted: '📤',
      bounty_released: '💰',
      bounty_refunded: '↩️',
      bounty_expired: '⏰',
    };
    return emojiMap[eventType] || '📢';
  }
}

/**
 * Webhook stub implementation - simulates HTTP POST
 * Easy to replace with real webhook service later
 */
export class WebhookNotificationService implements INotificationService {
  private webhookUrl?: string;
  private enabled: boolean;

  constructor(webhookUrl?: string, enabled = true) {
    this.webhookUrl = webhookUrl;
    this.enabled = enabled;
  }

  async notify(recipient: NotificationRecipient, payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.enabled || !this.webhookUrl) {
      // Fallback to console if webhook not configured
      const consoleService = new ConsoleNotificationService(this.enabled);
      return consoleService.notify(recipient, payload);
    }

    try {
      // Simulate webhook POST (stub - would use fetch/axios in production)
      const webhookPayload = {
        recipient,
        payload,
        deliveredAt: Date.now(),
      };

      console.log(`[Webhook Stub] Would POST to ${this.webhookUrl}:`, JSON.stringify(webhookPayload, null, 2));
      
      // In production, this would be:
      // const response = await fetch(this.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(webhookPayload),
      // });
      // if (!response.ok) throw new Error(`HTTP ${response.status}`);

      return { success: true, recipient, eventType: payload.eventType };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Webhook Notification Error]:', message);
      return { success: false, recipient, eventType: payload.eventType, error: message };
    }
  }

  async broadcast(recipients: NotificationRecipient[], payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    for (const recipient of recipients) {
      const result = await this.notify(recipient, payload);
      results.push(result);
    }
    return results;
  }
}

/**
 * Composite service - tries multiple notification methods
 * Core app behavior works even if notifications fail
 */
export class CompositeNotificationService implements INotificationService {
  private services: INotificationService[];

  constructor(services: INotificationService[]) {
    this.services = services;
  }

  async notify(recipient: NotificationRecipient, payload: NotificationPayload): Promise<NotificationResult> {
    // Try each service, return first success
    for (const service of this.services) {
      try {
        const result = await service.notify(recipient, payload);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn(`[Notification Service] ${service.constructor.name} failed:`, error);
        // Continue to next service - notifications are best-effort
      }
    }
    
    // All services failed, but don't block core functionality
    return { 
      success: false, 
      recipient, 
      eventType: payload.eventType, 
      error: 'All notification services failed (non-blocking)' 
    };
  }

  async broadcast(recipients: NotificationRecipient[], payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    for (const recipient of recipients) {
      const result = await this.notify(recipient, payload);
      results.push(result);
    }
    return results;
  }
}

/**
 * Default notification service instance
 * Uses console stub by default, easy to configure via environment
 */
export const defaultNotificationService: INotificationService = new CompositeNotificationService([
  new WebhookNotificationService(process.env.NOTIFICATION_WEBHOOK_URL, !!process.env.NOTIFICATION_WEBHOOK_URL),
  new ConsoleNotificationService(true), // Always log to console
]);

/**
 * Helper function to send notifications
 * Designed to be non-blocking - failures don't affect core bounty operations
 */
export async function sendNotification(
  recipients: NotificationRecipient[],
  eventType: NotificationEventType,
  bountyData: Omit<NotificationPayload, 'eventType' | 'timestamp' | 'metadata'>,
  metadata?: Record<string, unknown>,
): Promise<NotificationResult[]> {
  const payload: NotificationPayload = {
    ...bountyData,
    eventType,
    timestamp: Math.floor(Date.now() / 1000),
    metadata,
  };

  try {
    const results = await defaultNotificationService.broadcast(recipients, payload);
    return results;
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.error('[Notification] Failed to send:', error);
    return recipients.map(r => ({
      success: false,
      recipient: r,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}
