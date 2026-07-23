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
  createdAt: Date;
  student: SerializedAccessCodeStudent | null;
}

export interface AccessCodeStats {
  total: number;
  used: number;
  unused: number;
  expired: number;
}
