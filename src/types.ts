export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'professional' | 'beneficiary' | 'admin';
  createdAt: string;
}

export interface Session {
  id?: string;
  professionalId: string;
  beneficiaryId: string;
  activity: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  createdAt: string;
}

export interface Workshop {
  id?: string;
  title: string;
  type: string;
  professionalId: string;
  beneficiaryIds: string[];
  date: string;
  createdAt: string;
}
