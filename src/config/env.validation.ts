type EnvRule = {
  key: string;
  required?: boolean;
  nonEmpty?: boolean;
};

const ENV_RULES: EnvRule[] = [
  { key: 'PORT', required: true, nonEmpty: true },
  { key: 'NODE_ENV', required: true, nonEmpty: true },
  { key: 'API_PREFIX', required: true, nonEmpty: true },
  { key: 'SWAGGER_PATH', required: true, nonEmpty: true },
  { key: 'DB_HOST', required: true, nonEmpty: true },
  { key: 'DB_PORT', required: true, nonEmpty: true },
  { key: 'DB_USERNAME', required: true, nonEmpty: true },
  { key: 'DB_PASSWORD', required: true },
  { key: 'DB_DATABASE', required: true, nonEmpty: true },
  { key: 'JWT_SECRET', required: true, nonEmpty: true },
  { key: 'JWT_EXPIRES_IN', required: true, nonEmpty: true },
  { key: 'SMTP_HOST', required: true },
  { key: 'SMTP_PORT', required: true, nonEmpty: true },
  { key: 'SMTP_USE_SSL', required: true, nonEmpty: true },
  { key: 'SMTP_USE_TLS', required: true, nonEmpty: true },
  { key: 'SMTP_USER', required: true },
  { key: 'SMTP_PASS', required: true },
  { key: 'SMTP_FROM', required: true, nonEmpty: true },
  { key: 'OTP_TTL_MINUTES', required: true, nonEmpty: true },
  { key: 'OTP_HASH_SECRET', required: true, nonEmpty: true },
  { key: 'WHATSAPP_DEFAULT_PROVIDER', required: true, nonEmpty: true },
  { key: 'SMS_ENABLED', required: true, nonEmpty: true },
  { key: 'TWILIO_ACCOUNT_SID', required: true },
  { key: 'TWILIO_AUTH_TOKEN', required: true },
  { key: 'TWILIO_WHATSAPP_FROM', required: true },
  { key: 'META_WHATSAPP_ACCESS_TOKEN', required: true },
  { key: 'META_WHATSAPP_PHONE_NUMBER_ID', required: true },
  { key: 'META_WHATSAPP_API_VERSION', required: true, nonEmpty: true },
  { key: 'TERMII_API_KEY', required: true },
  { key: 'TERMII_SENDER_ID', required: true },
  { key: 'TERMII_BASE_URL', required: true, nonEmpty: true },
  { key: 'FLUTTERWAVE_SECRET_KEY', required: true, nonEmpty: true },
  { key: 'FLUTTERWAVE_SECRET_HASH', required: true, nonEmpty: true },
  { key: 'FLUTTERWAVE_BASE_URL', required: true, nonEmpty: true },
  { key: 'FLUTTERWAVE_DEFAULT_CURRENCY', required: true, nonEmpty: true },
  { key: 'DEFAULT_ONBOARDING_FEE', required: true, nonEmpty: true },
  { key: 'SUPER_ADMIN_EMAIL', required: true, nonEmpty: true },
  { key: 'SUPER_ADMIN_PASSWORD', required: true, nonEmpty: true },
  { key: 'SUPER_ADMIN_FIRST_NAME', required: true, nonEmpty: true },
  { key: 'SUPER_ADMIN_LAST_NAME', required: true, nonEmpty: true },
  { key: 'S3_ACCESS_KEY_ID' },
  { key: 'S3_SECRET_ACCESS_KEY' },
  { key: 'S3_REGION' },
  { key: 'S3_BUCKET_NAME' },
  { key: 'S3_ENDPOINT' },
  { key: 'S3_PUBLIC_BASE_URL' },
  { key: 'S3_FORCE_PATH_STYLE' },
];

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const rule of ENV_RULES) {
    const raw = config[rule.key];
    const isMissing = raw === undefined || raw === null;

    if (rule.required && isMissing) {
      errors.push(`${rule.key} is not defined in environment variables`);
      continue;
    }

    if (rule.nonEmpty && String(raw ?? '').trim() === '') {
      errors.push(`${rule.key} must not be empty`);
    }
  }

  const port = Number(config.PORT);
  if (Number.isNaN(port) || port <= 0) {
    errors.push('PORT must be a valid positive number');
  }

  const whatsappProvider = String(config.WHATSAPP_DEFAULT_PROVIDER ?? '')
    .trim()
    .toLowerCase();

  if (!['twilio', 'meta'].includes(whatsappProvider)) {
    errors.push('WHATSAPP_DEFAULT_PROVIDER must be twilio or meta');
  }

  const smsEnabled = String(config.SMS_ENABLED ?? '')
    .trim()
    .toLowerCase();

  if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(smsEnabled)) {
    errors.push('SMS_ENABLED must be true or false');
  }

  for (const key of ['SMTP_USE_SSL', 'SMTP_USE_TLS'] as const) {
    const value = String(config[key] ?? '')
      .trim()
      .toLowerCase();

    if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(value)) {
      errors.push(`${key} must be true or false`);
    }
  }

  const corsOrigins = String(config.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of corsOrigins) {
    if (!/^https?:\/\/.+/i.test(origin)) {
      errors.push(
        `CORS_ORIGINS entry "${origin}" must be a full origin (e.g. http://127.0.0.1:5500)`,
      );
    }
  }

  const s3ForcePathStyle = String(config.S3_FORCE_PATH_STYLE ?? '')
    .trim()
    .toLowerCase();

  if (
    s3ForcePathStyle &&
    !['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(
      s3ForcePathStyle,
    )
  ) {
    errors.push('S3_FORCE_PATH_STYLE must be true or false');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return config;
}
