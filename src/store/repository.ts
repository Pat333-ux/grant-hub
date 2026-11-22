import { ApplicantProfile, GrantApplicationRecord, GrantProgram } from '../types/domain';

interface MemberRecord { memberId: string; publicKeyPem: string; usedNonces: Set<string>; }
class InMemoryGrantRepository {
  private members = new Map<string, MemberRecord>();
  private grants = new Map<string, GrantProgram>();
  private applications = new Map<string, GrantApplicationRecord>();
  constructor() {
    const defaults: GrantProgram[] = [
      { grantId: 'grant_family_first_01', providerId: 'municipal_taskforce', title: 'Municipal Family Stabilization & Emergency Relief Grant', description: 'Rental and crisis assistance.', maxFundingAmount: 5000, category: 'family_first', minHouseholdSize: 1, maxAnnualIncome: 65000, requireDisability: false, requireVeteran: false, active: true },
      { grantId: 'grant_fssa_care_02', providerId: 'state_fssa', title: 'State Health & Wellbeing Support Fund', description: 'Healthcare, childcare, and basic needs support.', maxFundingAmount: 7500, category: 'housing_stabilization', minHouseholdSize: 2, maxAnnualIncome: 55000, requireDisability: false, requireVeteran: false, active: true },
      { grantId: 'grant_federal_skills_03', providerId: 'federal_grants', title: 'Federal Workforce Reskilling & Education Grant', description: 'Workforce education support.', maxFundingAmount: 10000, category: 'education_skills', minHouseholdSize: 1, maxAnnualIncome: 80000, requireDisability: false, requireVeteran: false, active: true },
      { grantId: 'grant_emergency_crisis_04', providerId: 'emergency_relief', title: 'Community Rapid Response Emergency Grant', description: 'Emergency shelter and utility assistance.', maxFundingAmount: 3000, category: 'emergency_assistance', minHouseholdSize: 1, maxAnnualIncome: 45000, requireDisability: false, requireVeteran: false, active: true },
      { grantId: 'grant_foundation_biz_05', providerId: 'community_foundation', title: 'Civic Innovation & Micro-Enterprise Grant', description: 'Local micro-enterprise grant.', maxFundingAmount: 15000, category: 'small_business', minHouseholdSize: 1, maxAnnualIncome: 95000, requireDisability: false, requireVeteran: false, active: true },
    ];
    defaults.forEach((g) => this.grants.set(g.grantId, g));
  }
  registerMember(memberId: string, publicKeyPem: string): MemberRecord {
    const existing = this.members.get(memberId); if (existing) { existing.publicKeyPem = publicKeyPem; return existing; }
    const record = { memberId, publicKeyPem, usedNonces: new Set<string>() }; this.members.set(memberId, record); return record;
  }
  getMember(id: string): MemberRecord | undefined { return this.members.get(id); }
  consumeNonce(id: string, nonce: string): boolean { const m = this.members.get(id); if (!m || m.usedNonces.has(nonce)) return false; m.usedNonces.add(nonce); return true; }
  listActiveGrants(): GrantProgram[] { return [...this.grants.values()].filter((g) => g.active); }
  getGrant(id: string): GrantProgram | undefined { return this.grants.get(id); }
  upsertApplication(record: GrantApplicationRecord): GrantApplicationRecord { this.applications.set(record.applicationId, record); return record; }
  getApplication(id: string): GrantApplicationRecord | undefined { return this.applications.get(id); }
  listApplicationsByMember(id: string): GrantApplicationRecord[] { return [...this.applications.values()].filter((a) => a.memberId === id); }
}
export const repository = new InMemoryGrantRepository();
