import { Partner } from '../entities/partner.entity';
import { PublicPartnerView } from '../types/public-partner-view.type';

export function toPublicPartner(partner: Partner): PublicPartnerView {
  return {
    id: partner.id,
    firstName: partner.firstName,
    lastName: partner.lastName,
    email: partner.email,
    phoneNumber: partner.phoneNumber,
    address: partner.address,
    description: partner.description,
    logoUrl: partner.logoUrl,
    onboardingFee:
      partner.onboardingFee !== null && partner.onboardingFee !== undefined
        ? Number(partner.onboardingFee)
        : null,
    status: partner.status,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}
