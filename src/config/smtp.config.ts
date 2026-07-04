import { registerAs } from '@nestjs/config';

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim();
}

export default registerAs('smtp', () => {
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const useSsl =
    process.env.SMTP_USE_SSL !== undefined
      ? parseBoolean(process.env.SMTP_USE_SSL)
      : process.env.SMTP_SECURE !== undefined
        ? parseBoolean(process.env.SMTP_SECURE)
        : port === 465;

  const useTls =
    process.env.SMTP_USE_TLS !== undefined
      ? parseBoolean(process.env.SMTP_USE_TLS)
      : port === 587;

  return {
    host: stripQuotes(process.env.SMTP_HOST ?? ''),
    port,
    secure: useSsl,
    requireTls: useTls && !useSsl,
    user: stripQuotes(process.env.SMTP_USER ?? ''),
    pass: stripQuotes(process.env.SMTP_PASS ?? ''),
    from:
      stripQuotes(process.env.SMTP_FROM ?? '') ||
      stripQuotes(process.env.DEFAULT_FROM_EMAIL ?? '') ||
      'Digital Malamai <no-reply@digitalmalamai.com>',
  };
});
