import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compute2026FplCents,
  evaluateHouseholdEligibility,
} from '../dist/domain/eligibility/evaluator.js';

const rules = {
  fplBaseCents2026: 15_000_000,
  fplPerAdditionalPersonCents2026: 5_000_000,
  maxFplMultiplier: 2,
  allowedStates: ['IN'],
  requiresDependentChildren: true,
  requiredVerifications: ['PROOF_OF_INCOME', 'HOUSEHOLD_COMPOSITION'],
};

test('calculates FPL thresholds for household sizes one through six and larger', () => {
  for (let size = 1; size <= 6; size += 1) {
    assert.equal(compute2026FplCents(size, rules), 15_000_000 + (size - 1) * 5_000_000);
  }
  assert.equal(compute2026FplCents(8, rules), 50_000_000);
});

test('clamps zero, negative, and fractional household sizes safely', () => {
  assert.equal(compute2026FplCents(0, rules), 15_000_000);
  assert.equal(compute2026FplCents(-2, rules), 15_000_000);
  assert.equal(compute2026FplCents(2.9, rules), 20_000_000);
});

test('income exactly at the configured FPL multiplier remains eligible', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 2,
    annualGrossIncomeCents: 40_000_000,
    stateCode: 'in',
    hasDependentChildren: true,
  }, rules);

  assert.equal(result.eligible, true);
  assert.equal(result.fplThresholdCents, 20_000_000);
  assert.equal(result.incomeRatioToFpl, 2);
  assert.deepEqual(result.disqualificationReasons, []);
  assert.deepEqual(result.missingVerifications, ['PROOF_OF_INCOME', 'HOUSEHOLD_COMPOSITION']);
});

test('income one cent over the multiplier threshold is disqualified', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 2,
    annualGrossIncomeCents: 40_000_001,
    stateCode: 'IN',
    hasDependentChildren: true,
  }, rules);

  assert.equal(result.eligible, false);
  assert.match(result.disqualificationReasons[0], /income exceeds 200%/);
});

test('reports out-of-state, income, and dependent-child disqualifications', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 1,
    annualGrossIncomeCents: 30_000_001,
    stateCode: 'IL',
    hasDependentChildren: false,
  }, rules);

  assert.equal(result.eligible, false);
  assert.equal(result.disqualificationReasons.length, 3);
});

test('pregnancy and senior/disability indicators increase a non-saturated score', () => {
  const profile = {
    householdSize: 1,
    annualGrossIncomeCents: 29_000_000,
    stateCode: 'IN',
    hasDependentChildren: true,
  };
  const ordinary = evaluateHouseholdEligibility(profile, rules);
  const disabilityOrSenior = evaluateHouseholdEligibility({ ...profile, hasDisabilityOrSenior: true }, rules);
  const pregnant = evaluateHouseholdEligibility({ ...profile, pregnant: true }, rules);

  assert.ok(disabilityOrSenior.matchScore > ordinary.matchScore);
  assert.ok(pregnant.matchScore > ordinary.matchScore);
  assert.equal(disabilityOrSenior.matchScore, pregnant.matchScore);
});

test('returns all required verification checklist items', () => {
  const result = evaluateHouseholdEligibility({
    householdSize: 3,
    annualGrossIncomeCents: 30_000_000,
    stateCode: 'IN',
    hasDependentChildren: true,
  }, rules);

  assert.deepEqual(result.missingVerifications, rules.requiredVerifications);
});
