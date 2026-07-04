export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeE164Phone(phone: string): string {
  const digits = normalizePhoneDigits(phone);

  if (phone.trim().startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+234${digits.slice(1)}`;
  }

  if (digits.startsWith('234')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function toTwilioWhatsAppAddress(phone: string): string {
  const e164 = normalizeE164Phone(phone);
  return `whatsapp:${e164}`;
}

export function toMetaWhatsAppRecipient(phone: string): string {
  return normalizePhoneDigits(normalizeE164Phone(phone));
}

export function toTermiiRecipient(phone: string): string {
  const digits = normalizePhoneDigits(normalizeE164Phone(phone));
  return digits.startsWith('234') ? digits : digits;
}
