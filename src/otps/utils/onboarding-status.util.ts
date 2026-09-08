import { OnboardingStatus } from '../../common/types/onboarding-status.type';
import { User } from '../../user/entities/user.entity';

export function resolveOnboardingStatus(user: User): OnboardingStatus {
  // A student who has already paid is fully onboarded. Verifying WhatsApp/email
  // afterwards must never downgrade that status (email verification is optional).
  if (user.onboardingStatus === OnboardingStatus.ONBOARDED) {
    return OnboardingStatus.ONBOARDED;
  }

  const emailVerified = Boolean(user.emailVerifiedAt);
  const phoneVerified = Boolean(user.phoneVerifiedAt);

  if (emailVerified && phoneVerified) {
    return OnboardingStatus.VERIFIED;
  }

  if (phoneVerified) {
    return OnboardingStatus.PHONE_VERIFIED;
  }

  if (emailVerified) {
    return OnboardingStatus.EMAIL_VERIFIED;
  }

  return OnboardingStatus.PENDING;
}
