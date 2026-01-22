/**
 * Slack notification utilities
 *
 * Sends messages to Slack via Incoming Webhooks.
 * Used for signup notifications, waitlist alerts, etc.
 *
 * @see https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
 */

interface SlackMessage {
  text: string;
  blocks?: unknown[];
}

/**
 * Sends a notification to Slack via Incoming Webhook.
 *
 * This function is intentionally fire-and-forget - it won't throw errors
 * or block the main flow if Slack is unavailable. Notifications are
 * non-critical, so failures are logged but not propagated.
 *
 * @param message - Slack message with text and optional blocks
 */
export async function sendSlackNotification(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[Slack] Failed to send notification:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
  }
}

/**
 * Formats a timestamp in Korean timezone (KST).
 */
export function formatKoreanTime(date: Date = new Date()): string {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
