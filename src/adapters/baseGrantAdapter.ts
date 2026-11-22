import { ApplicantProfile, ApplicationStatus, GrantProviderId } from '../types/domain';
export interface GrantSubmissionResponse { status: ApplicationStatus; externalRefId: string; awardedAmount?: number; }
export interface IGrantProviderAdapter { readonly providerId: GrantProviderId; readonly displayName: string; submitPrefilledGrantApplication(applicationId: string, grantId: string, applicant: ApplicantProfile): Promise<GrantSubmissionResponse>; }
export abstract class BaseGrantAdapter implements IGrantProviderAdapter {
  abstract readonly providerId: GrantProviderId; abstract readonly displayName: string;
  protected mapProfileToProviderSchema(applicant: ApplicantProfile, grantId: string) {
    return { target_grant_id: grantId, applicant_name: applicant.fullName, email: applicant.email, phone_number: applicant.phone, residence: { address: applicant.streetAddress, city: applicant.city, state: applicant.state, zip: applicant.postalCode }, household: { size: applicant.householdSize, annual_income: applicant.annualHouseholdIncome, veteran_status: applicant.isVeteran, disability_status: applicant.isDisabilityBenefitRecipient } };
  }
  async submitPrefilledGrantApplication(applicationId: string, grantId: string, applicant: ApplicantProfile): Promise<GrantSubmissionResponse> { return this.sendToProviderEndpoint(applicationId, this.mapProfileToProviderSchema(applicant, grantId)); }
  protected abstract sendToProviderEndpoint(applicationId: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse>;
}
