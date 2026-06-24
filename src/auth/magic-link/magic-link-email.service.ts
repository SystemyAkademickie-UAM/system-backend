import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';

import {
  MAGIC_LINK_EMAIL_BODY_ENV_KEY,
  MAGIC_LINK_EMAIL_SUBJECT_ENV_KEY,
  MAGIC_LINK_URL_PLACEHOLDER,
} from '../../constants/magic-link-constants';
import {
  SMTP_DEFAULT_FROM,
  SMTP_DEFAULT_HOST,
  SMTP_DEFAULT_PORT,
  SMTP_FROM_ENV_KEY,
  SMTP_HOST_ENV_KEY,
  SMTP_IMPLICIT_TLS_PORT,
  SMTP_PASSWORD_ENV_KEY,
  SMTP_PORT_ENV_KEY,
  SMTP_USER_ENV_KEY,
} from '../../constants/smtp-constants';

type SmtpTransportError = Error & {
  code?: string;
  response?: string;
  responseCode?: number;
};

/**
 * Sends magic-link emails via institutional SMTP (fire-and-forget from callers).
 */
@Injectable()
export class MagicLinkEmailService {
  private readonly logger = new Logger(MagicLinkEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Sends the login email asynchronously; logs failures without throwing to the caller.
   */
  sendMagicLinkEmail(email: string, verifyUrl: string): void {
    this.dispatchEmail(email, verifyUrl).catch((err: unknown) => {
      const host = this.configService.get<string>(SMTP_HOST_ENV_KEY, '').trim();
      const user = this.configService.get<string>(SMTP_USER_ENV_KEY, '').trim();
      this.logger.error(
        `Failed to send magic link email to ${email} via ${host} as ${user}: ${this.formatSmtpError(err)}`);
    });
  }

  assertSmtpConfigured(): void {
    if (!this.isSmtpConfigured()) {
      throw new ServiceUnavailableException({
        error: 'MAGIC_LINK_SMTP_NOT_CONFIGURED',
        message: 'Email login is not configured on this server.',
      });
    }
  }

  private async dispatchEmail(email: string, verifyUrl: string): Promise<void> {
    this.assertSmtpConfigured();
    const transporter = this.resolveTransporter();
    const subject = this.configService.get<string>(MAGIC_LINK_EMAIL_SUBJECT_ENV_KEY, '').trim();
    const bodyTemplate = this.configService.get<string>(MAGIC_LINK_EMAIL_BODY_ENV_KEY, '').trim();
    const from = this.resolveFromAddress();
    const smtpUser = this.configService.get<string>(SMTP_USER_ENV_KEY, '').trim();
    if (subject === '' || bodyTemplate === '' || from === '') {
      throw new Error('Magic link email subject, body template, or SMTP from address is missing');
    }
    if (!bodyTemplate.includes(MAGIC_LINK_URL_PLACEHOLDER)) {
      throw new Error(`Magic link email body must include ${MAGIC_LINK_URL_PLACEHOLDER}`);
    }
    const text = this.formatEmailBody(bodyTemplate, verifyUrl);
    await transporter.sendMail(this.buildMailOptions(from, smtpUser, email, subject, text));
    this.logger.log(`Magic link email sent to ${email}`);
  }

  private resolveFromAddress(): string {
    const from = this.configService.get<string>(SMTP_FROM_ENV_KEY, SMTP_DEFAULT_FROM).trim();
    return from === '' ? SMTP_DEFAULT_FROM : from;
  }

  private formatEmailBody(bodyTemplate: string, verifyUrl: string): string {
    const withUrl = bodyTemplate.split(MAGIC_LINK_URL_PLACEHOLDER).join(verifyUrl);
    return withUrl.replace(/\\n/g, '\n');
  }

  private buildMailOptions(
    from: string,
    smtpUser: string,
    to: string,
    subject: string,
    text: string): SendMailOptions {
    const options: SendMailOptions = { from, to, subject, text };
    if (smtpUser !== '' && !from.includes(smtpUser)) {
      options.envelope = { from: smtpUser, to: [to] };
      options.sender = smtpUser;
    }
    return options;
  }

  private formatSmtpError(err: unknown): string {
    if (!(err instanceof Error)) {
      return String(err);
    }
    const smtpErr = err as SmtpTransportError;
    const parts = [err.message];
    if (smtpErr.code !== undefined && smtpErr.code !== '') {
      parts.push(`code=${smtpErr.code}`);
    }
    if (smtpErr.responseCode !== undefined) {
      parts.push(`responseCode=${smtpErr.responseCode}`);
    }
    if (smtpErr.response !== undefined && smtpErr.response !== '') {
      parts.push(`response=${smtpErr.response.trim()}`);
    }
    return parts.join(' ');
  }

  private isSmtpConfigured(): boolean {
    const host = this.configService.get<string>(SMTP_HOST_ENV_KEY, '').trim();
    const user = this.configService.get<string>(SMTP_USER_ENV_KEY, '').trim();
    const password = this.configService.get<string>(SMTP_PASSWORD_ENV_KEY, '').trim();
    const subject = this.configService.get<string>(MAGIC_LINK_EMAIL_SUBJECT_ENV_KEY, '').trim();
    const body = this.configService.get<string>(MAGIC_LINK_EMAIL_BODY_ENV_KEY, '').trim();
    return host !== '' && user !== '' && password !== '' && subject !== '' && body !== '';
  }

  private resolveTransporter(): Transporter {
    if (this.transporter !== null) {
      return this.transporter;
    }
    const host = this.configService.get<string>(SMTP_HOST_ENV_KEY, SMTP_DEFAULT_HOST).trim();
    const portRaw = this.configService.get<string>(SMTP_PORT_ENV_KEY, String(SMTP_DEFAULT_PORT)).trim();
    const port = Number.parseInt(portRaw, 10);
    const resolvedPort = Number.isFinite(port) ? port : SMTP_DEFAULT_PORT;
    const user = this.configService.get<string>(SMTP_USER_ENV_KEY, '').trim();
    const password = this.configService.get<string>(SMTP_PASSWORD_ENV_KEY, '').trim();
    const useImplicitTls = resolvedPort === SMTP_IMPLICIT_TLS_PORT;
    this.transporter = nodemailer.createTransport({
      host,
      port: resolvedPort,
      secure: useImplicitTls,
      requireTLS: !useImplicitTls,
      auth: { user, pass: password },
    });
    return this.transporter;
  }
}
