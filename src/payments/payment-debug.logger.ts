import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class PaymentDebugLogger {
  private readonly logger = new Logger(PaymentDebugLogger.name);
  private readonly enabled: boolean;
  private readonly debugLogFilePath: string;
  private readonly webhookLogFilePath: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<string>('app.paymentDebugLogs') === 'true' ||
      process.env.PAYMENT_DEBUG_LOGS === 'true';
    this.debugLogFilePath = join(process.cwd(), 'logs', 'payment-debug.log');
    this.webhookLogFilePath = join(process.cwd(), 'logs', 'payment-webhook.log');
  }

  async log(event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.writeLog(this.debugLogFilePath, event, payload);
  }

  async logWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`[${event}] ${JSON.stringify(payload)}`);
    await this.writeLog(this.webhookLogFilePath, event, payload);
  }

  private async writeLog(
    filePath: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...payload,
    };

    try {
      await mkdir(join(process.cwd(), 'logs'), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      this.logger.error(
        `Failed to write ${filePath}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
