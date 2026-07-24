export interface SerializedAccessCodeStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SerializedAccessCode {
  id: string;
  code: string;
  partnerId: string | null;
  isUsed: boolean;
  expiresAt: Date | null;
  exportedAt: Date | null;
  createdAt: Date;
  student: SerializedAccessCodeStudent | null;
}

export interface SerializedAccessCodePartner {
  id: string;
  firstName: string;
  lastName: string;
  logoUrl: string | null;
}

export interface SerializedAccessCodeDetail extends SerializedAccessCode {
  partner: SerializedAccessCodePartner;
}

export interface AccessCodeStats {
  total: number;
  used: number;
  unused: number;
  expired: number;
  exported: number;
  readyToExport: number;
  /** Unused, not expired, already exported — available for re-export */
  reexportable: number;
}
