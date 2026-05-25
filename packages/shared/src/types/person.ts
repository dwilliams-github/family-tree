export interface PersonSummary {
  id: string;
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  isLiving: boolean;
  hasPhoto: boolean;
}

export interface Person extends PersonSummary {
  birthName?: string;
  gender?: 'male' | 'female' | 'other';
  placeOfBirth?: string;
  placeOfDeath?: string;
  bio?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  firstName: string;
  lastName?: string;
  birthName?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  dateOfDeath?: string;
  placeOfBirth?: string;
  placeOfDeath?: string;
  bio?: string;
  isLiving?: boolean;
}
