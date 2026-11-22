export interface HouseholdProfile {
  householdSize: number;
  annualGrossIncomeCents: number;
  stateCode: string; // e.g., "IN"
  county?: string;
  hasDependentChildren?: boolean;
  pregnant?: boolean;
  hasDisabilityOrSenior?: boolean;
}

export interface EligibilityRuleSet {
  fplBaseCents2026: number;
  fplPerAdditionalPersonCents2026: number;
  maxFplMultiplier: number;
  allowedStates?: string[];
  requiresDependentChildren?: boolean;
  requiredVerifications: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  matchScore: number; // 0 - 100
  fplThresholdCents: number;
  incomeRatioToFpl: number;
  disqualificationReasons: string[];
  missingVerifications: string[];
}

export function compute2026FplCents(
  householdSize: number,
  rules: EligibilityRuleSet
): number {
  const safeSize = Math.max(1, Math.floor(householdSize));
  const extraMembers = Math.max(0, safeSize - 1);
  return (
    rules.fplBaseCents2026 + extraMembers * rules.fplPerAdditionalPersonCents2026
  );
}

export function evaluateHouseholdEligibility(
  profile: HouseholdProfile,
  rules: EligibilityRuleSet
): EligibilityResult {
  const reasons: string[] = [];
  let score = 100;

  if (rules.allowedStates && rules.allowedStates.length > 0) {
    if (!rules.allowedStates.includes(profile.stateCode.toUpperCase())) {
      reasons.push(`State ${profile.stateCode} is outside program jurisdiction.`);
      score -= 50;
    }
  }

  if (rules.requiresDependentChildren && !profile.hasDependentChildren) {
    reasons.push("Program requires dependent children in the household.");
    score -= 35;
  }

  const fplThresholdCents = compute2026FplCents(profile.householdSize, rules);
  const maxAllowedIncomeCents = Math.round(
    fplThresholdCents * rules.maxFplMultiplier
  );
  const incomeRatioToFpl =
    fplThresholdCents > 0
      ? Number((profile.annualGrossIncomeCents / fplThresholdCents).toFixed(4))
      : 0;

  if (profile.annualGrossIncomeCents > maxAllowedIncomeCents) {
    reasons.push(
      `Household income exceeds ${Math.round(rules.maxFplMultiplier * 100)}% of 2026 FPL limit.`
    );
    score -= 40;
  } else {
    // Reward lower income-to-FPL ratio for higher prioritization score
    const headroomBonus = Math.max(
      0,
      Math.min(15, Math.round((1 - incomeRatioToFpl / rules.maxFplMultiplier) * 15))
    );
    score = Math.min(100, score + headroomBonus);
  }

  if (profile.hasDisabilityOrSenior || profile.pregnant) {
    score = Math.min(100, score + 10);
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  return {
    eligible: reasons.length === 0,
    matchScore: clampedScore,
    fplThresholdCents,
    incomeRatioToFpl,
    disqualificationReasons: reasons,
    missingVerifications: [...rules.requiredVerifications],
  };
}
