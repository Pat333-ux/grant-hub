import { ApplicantProfile, GrantProgram, MatchScoreResult } from '../types/domain';
export class StandaloneGrantMatchingEngine {
  evaluateGrantMatch(applicant: ApplicantProfile, grant: GrantProgram): MatchScoreResult {
    const matchedCriteria: string[] = []; const disqualificationReasons: string[] = []; let score = grant.active ? 50 : 0;
    if (!grant.active) disqualificationReasons.push('Grant is not active');
    if (applicant.annualHouseholdIncome <= grant.maxAnnualIncome) { matchedCriteria.push(`Income meets limit of $${grant.maxAnnualIncome}`); score += 20; } else disqualificationReasons.push(`Income exceeds limit of $${grant.maxAnnualIncome}`);
    if (applicant.householdSize >= grant.minHouseholdSize) { matchedCriteria.push(`Household size meets minimum of ${grant.minHouseholdSize}`); score += 15; } else disqualificationReasons.push(`Household size below required ${grant.minHouseholdSize}`);
    if (grant.requireDisability) { if (applicant.isDisabilityBenefitRecipient) { matchedCriteria.push('Disability status matches requirement'); score += 15; } else disqualificationReasons.push('Requires disability benefit recipient status'); }
    if (grant.requireVeteran) { if (applicant.isVeteran) { matchedCriteria.push('Veteran status matches requirement'); score += 10; } else disqualificationReasons.push('Requires veteran status'); }
    if (applicant.primaryGrantCategory === grant.category) { matchedCriteria.push(`Category alignment: ${grant.category}`); score += 15; }
    const eligible = disqualificationReasons.length === 0;
    return { grantId: grant.grantId, providerId: grant.providerId, title: grant.title, eligible, score: eligible ? Math.min(score, 100) : 0, matchedCriteria, disqualificationReasons };
  }
  rankGrantMatches(applicant: ApplicantProfile, grants: GrantProgram[]): MatchScoreResult[] { return grants.map((g) => this.evaluateGrantMatch(applicant, g)).sort((a, b) => b.score - a.score); }
}
export const matchingEngine = new StandaloneGrantMatchingEngine();
