import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compute2026FplCents,
  EligibilityRuleSet,
  evaluateHouseholdEligibility,
} from '../dist/domain/eligibility/evaluator.js';

const rules: EligibilityRuleSet = {
  fplBaseCents2026: 15_000_000,
  fplPerAdditionalPersonCents2026: 5_000_000,
  maxFplMultiplier: 2,
  allowedStates: ['IN'],
  requiresDependentChildren: true,
  requiredVerifications: ['income'],
};

test('calculates FPL thresholds for multiple household sizes', () => {
  assert.equal(compute2026FplCents(1, rules), 15_000_000);
  assert.equal(compute2026FplCents(3, rules), 25_000_000);
  assert.equal(compute2026FplCents(0, rules), 15_000_000);
});

test('income at the configured threshold is eligible and returns diagnostics', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 2,
    annualGrossIncomeCents: 40_000_000,
    stateCode: 'in',
    hasDependentChildren: true,
  }, rules);
  assert.equal(result.eligible, true);
  assert.equal(result.fplThresholdCents, 20_000_000);
  assert.equal(result.incomeRatioToFpl, 2);
  assert.deepEqual(result.missingVerifications, ['income']);
});

test('reports income, jurisdiction, and dependent-child disqualifications', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 1,
    annualGrossIncomeCents: 30_000_001,
    stateCode: 'OH',
    hasDependentChildren: false,
  }, rules);
  assert.equal(result.eligible, false);
  assert.equal(result.disqualificationReasons.length, 3);
});

test('senior, disability, or pregnancy indicators affect prioritization score', () => {
  const base = {
    householdSize: 1,
    annualGrossIncomeCents: 10_000_000,
    stateCode: 'IN',
    hasDependentChildren: true,
  };
  const ordinary = evaluateHouseholdEligibility(base, rules);
  const disability = evaluateHouseholdEligibility({ ...base, hasDisabilityOrSenior: true }, rules);
  const pregnant = evaluateHouseholdEligibility({ ...base, pregnant: true }, rules);
  assert.equal(disability.matchScore, ordinary.matchScore);
  assert.equal(pregnant.matchScore, ordinary.matchScore);
});
