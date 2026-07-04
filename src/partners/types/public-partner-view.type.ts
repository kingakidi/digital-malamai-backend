import { PartnerStatus } from '../../common/types/partner-status.type';

export interface PublicPartnerView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  description: string | null;
  logoUrl: string | null;
  onboardingFee: number | null;
  status: PartnerStatus;
  createdAt: Date;
  updatedAt: Date;
}
