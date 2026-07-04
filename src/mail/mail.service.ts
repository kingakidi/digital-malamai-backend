import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailTemplateService } from './mail-template.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailTemplateService: MailTemplateService,
  ) {}

  async sendTemplateMail(
    to: string,
    templateName: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const { subject, body } = this.mailTemplateService.render(
      templateName,
      variables,
    );

    await this.sendMail(to, subject, body);
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `SMTP not configured — skipped email to ${to} (${subject})`,
      );
      return;
    }

    await transporter.sendMail({
      from: this.configService.get<string>('smtp.from'),
      to,
      subject,
      html,
    });
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('smtp.host');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');

    if (!host || !user || !pass) {
      return null;
    }

    const port = this.configService.get<number>('smtp.port') ?? 587;
    const secure = this.configService.get<boolean>('smtp.secure') ?? port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: this.configService.get<boolean>('smtp.requireTls') ?? false,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    });

    return this.transporter;
  }
}
