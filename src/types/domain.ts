export type GrantProviderId = 'federal_grants' | 'state_fssa' | 'municipal_taskforce' | 'emergency_relief' | 'community_foundation';
export const ALL_GRANT_PROVIDERS: GrantProviderId[] = ['federal_grants', 'state_fssa', 'municipal_taskforce', 'emergency_relief', 'community_foundation'];

export interface ApplicantProfile {
  applicantId: string; fullName: string; email: string; phone: string; streetAddress: string; city: string; state: string; postalCode: string;
  householdSize: number; annualHouseholdIncome: number; isVeteran: boolean; isDisabilityBenefitRecipient: boolean;
  primaryGrantCategory: 'housing_stabilization' | 'family_first' | 'education_skills' | 'emergency_assistance' | 'small_business';
}
export interface GrantProgram {
  grantId: string; providerId: GrantProviderId; title: string; description: string; maxFundingAmount: number; category: string;
  minHouseholdSize: number; maxAnnualIncome: number; requireDisability: boolean; requireVeteran: boolean; active: boolean;
}
export interface MatchScoreResult {
  grantId: string; providerId: GrantProviderId; title: string; eligible: boolean; score: number; matchedCriteria: string[]; disqualificationReasons: string[];
}
export interface SignedGrantPayload {
  requestId: string; memberId: string; timestamp: number; nonce: string; selectedGrantIds: string[]; applicant: ApplicantProfile;
}
export type ApplicationStatus = 'QUEUED' | 'SUBMITTED' | 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'FAILED';
export interface GrantApplicationRecord {
  applicationId: string; requestId: string; memberId: string; grantId: string; providerId: GrantProviderId; status: ApplicationStatus;
  awardedAmount?: number; externalRefId?: string; updatedAt: string; error?: string;
}
export interface ProviderWebhookEvent {
  eventId: string; providerId: GrantProviderId; applicationId: string; externalRefId: string; status: ApplicationStatus;
  awardedAmount?: number; occurredAt: string;
}
