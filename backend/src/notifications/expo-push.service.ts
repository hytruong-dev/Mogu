import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?:
      | 'DeviceNotRegistered'
      | 'MessageTooBig'
      | 'MessageRateExceeded'
      | 'MismatchSenderId'
      | 'InvalidCredentials';
  };
}

export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
}

export interface PushDeliveryResult {
  targeted: number;
  sent: number;
  failed: number;
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send Expo Push notification to a list of users by their active push installations.
   */
  async sendToUsers(
    userIds: string[],
    payload: PushMessagePayload,
  ): Promise<PushDeliveryResult> {
    if (!userIds || userIds.length === 0) {
      return { targeted: 0, sent: 0, failed: 0 };
    }

    const installations = await (this.prisma.db as any).pushInstallation.findMany({
      where: {
        userId: { in: userIds },
        invalidatedAt: null,
      },
      select: {
        id: true,
        userId: true,
        token: true,
      },
    });

    if (!installations || installations.length === 0) {
      return { targeted: 0, sent: 0, failed: 0 };
    }

    return this.sendToInstallations(installations, payload);
  }

  /**
   * Internal helper to batch send to push installations and invalidate invalid tokens.
   */
  async sendToInstallations(
    installations: Array<{ id: string; userId?: string; token: string }>,
    payload: PushMessagePayload,
  ): Promise<PushDeliveryResult> {
    let sent = 0;
    let failed = 0;
    const tokensToInvalidate: string[] = [];
    const expoBatchSize = 100;

    for (let i = 0; i < installations.length; i += expoBatchSize) {
      const chunk = installations.slice(i, i + expoBatchSize);
      const messages = chunk
        .filter((inst) => inst.token && inst.token.startsWith('ExponentPushToken['))
        .map((inst) => ({
          to: inst.token,
          sound: payload.sound ?? 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        }));

      // Count those that didn't have valid format as failed immediately
      const invalidCount = chunk.length - messages.length;
      if (invalidCount > 0) {
        failed += invalidCount;
      }

      if (messages.length === 0) continue;

      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });

        if (res.ok) {
          const json = (await res.json()) as { data?: ExpoPushTicket[] };
          const tickets = json.data ?? [];
          tickets.forEach((ticket, idx) => {
            if (ticket.status === 'ok') {
              sent++;
            } else {
              failed++;
              if (ticket.details?.error === 'DeviceNotRegistered') {
                tokensToInvalidate.push(chunk[idx]?.id);
              }
            }
          });
        } else {
          this.logger.warn(`Expo push send returned HTTP ${res.status}`);
          failed += messages.length;
        }
      } catch (err: any) {
        this.logger.error(`Error sending push batch to Expo: ${err.message}`);
        failed += messages.length;
      }
    }

    if (tokensToInvalidate.length > 0) {
      const validIds = tokensToInvalidate.filter(Boolean);
      if (validIds.length > 0) {
        await (this.prisma.db as any).pushInstallation
          .updateMany({
            where: { id: { in: validIds } },
            data: { invalidatedAt: new Date() },
          })
          .catch((e: any) =>
            this.logger.warn(`Failed to invalidate dead push tokens: ${e.message}`),
          );
      }
    }

    return {
      targeted: installations.length,
      sent,
      failed,
    };
  }
}
