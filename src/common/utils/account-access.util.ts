import { UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '../types/account-status.type';

interface AccountAccessUser {
  isActive: boolean;
  accountStatus?: AccountStatus | null;
}

export function assertAccountCanAuthenticate(user: AccountAccessUser): void {
  const status = user.accountStatus ?? AccountStatus.ACTIVE;

  if (status === AccountStatus.ACTIVE && user.isActive) {
    return;
  }

  if (status === AccountStatus.SUSPENDED) {
    throw new UnauthorizedException('Your account has been suspended');
  }

  if (status === AccountStatus.DISABLED || !user.isActive) {
    throw new UnauthorizedException('This account cannot be accessed');
  }

  throw new UnauthorizedException('This account cannot be accessed');
}

export function registrationBlockMessage(
  user: AccountAccessUser,
  field: 'email' | 'phone',
): string {
  const status = user.accountStatus ?? (user.isActive ? AccountStatus.ACTIVE : AccountStatus.DISABLED);
  const label = field === 'email' ? 'Email' : 'Phone number';

  if (status === AccountStatus.SUSPENDED) {
    return `${label} is linked to a suspended account and cannot be reused`;
  }

  return `${label} is linked to an existing account and cannot be reused`;
}

export function syncAccountActiveFlag(
  accountStatus: AccountStatus,
): boolean {
  return accountStatus === AccountStatus.ACTIVE;
}
