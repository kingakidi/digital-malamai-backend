import { OnboardingStatus } from '../../common/types/onboarding-status.type';
import { User } from '../../user/entities/user.entity';

export function resolveOnboardingStatus(user: User): OnboardingStatus {
  const emailVerified = Boolean(user.emailVerifiedAt);
  const phoneVerified = Boolean(user.phoneVerifiedAt);

  if (emailVerified && phoneVerified) {
    return OnboardingStatus.VERIFIED;
  }

  if (emailVerified) {
    return OnboardingStatus.EMAIL_VERIFIED;
  }

  if (phoneVerified) {
    return OnboardingStatus.PHONE_VERIFIED;
  }

  return OnboardingStatus.PENDING;
}
