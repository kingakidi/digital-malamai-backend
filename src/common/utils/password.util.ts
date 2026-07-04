import { randomBytes } from 'crypto';

const PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARS[bytes[i]! % PASSWORD_CHARS.length];
  }

  return password;
}
