import { createHash } from "node:crypto";
import {
  ApplicationStatus,
  OutboxStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  evaluateHouseholdEligibility,
  type EligibilityRuleSet,
  type HouseholdProfile,
} from "../domain/eligibility/evaluator.js";

export interface SubmitApplicationInput {
  requestId: string;
  memberId: string;
  grantId: string;
  nonce: string;
  nonceExpiresAt: Date;
  household: HouseholdProfile;
  rawPayloadForHash: unknown;
}

export interface SubmitApplicationOutput {
  applicationId: string;
  requestId: string;
  status: ApplicationStatus;
  eligible: boolean;
  matchScore: number;
  outboxEventId: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function canonicalJsonHash(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value ?? {}));
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

function parseRuleSet(rulesJson: Prisma.JsonValue): EligibilityRuleSet {
  if (!rulesJson || typeof rulesJson !== "object" || Array.isArray(rulesJson)) {
    throw new Error("Grant rulesJson must be a valid eligibility rule object");
  }

  const raw = rulesJson as Record<string, unknown>;
  return {
    fplBaseCents2026: Number(raw.fplBaseCents2026 ?? 0),
    fplPerAdditionalPersonCents2026: Number(
      raw.fplPerAdditionalPersonCents2026 ?? 0,
    ),
    maxFplMultiplier: Number(raw.maxFplMultiplier ?? 1),
    allowedStates: Array.isArray(raw.allowedStates)
      ? raw.allowedStates.map((state) => String(state))
      : undefined,
    requiresDependentChildren: Boolean(raw.requiresDependentChildren ?? false),
    requiredVerifications: Array.isArray(raw.requiredVerifications)
      ? raw.requiredVerifications.map((verification) => String(verification))
      : [],
  };
}

/**
 * Persists a single-grant application together with its nonce, outbox event,
 * and audit record. Any failure rolls the entire transaction back.
 * Signature verification must be completed by the trusted intake boundary
 * before this service is called.
 */
export async function submitApplicationAtomic(
  prisma: PrismaClient,
  input: SubmitApplicationInput,
): Promise<SubmitApplicationOutput> {
  const payloadHash = canonicalJsonHash(input.rawPayloadForHash);

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { id: input.memberId },
      select: { id: true, keyActive: true, keyRevokedAt: true },
    });
    if (!member || !member.keyActive || member.keyRevokedAt !== null) {
      throw new Error("Member is not registered or signing key is inactive/revoked");
    }

    if (!Number.isFinite(input.nonceExpiresAt.getTime()) || input.nonceExpiresAt.getTime() <= Date.now()) {
      throw new Error("Request nonce has expired");
    }
    if (!input.nonce.trim()) {
      throw new Error("Request nonce is required");
    }

    // The (memberId, nonce) primary key makes this claim race-safe across workers.
    await tx.usedNonce.create({
      data: {
        memberId: input.memberId,
        nonce: input.nonce,
        expiresAt: input.nonceExpiresAt,
      },
    });

    const grant = await tx.grant.findUnique({
      where: { id: input.grantId },
      select: { id: true, code: true, active: true, rulesJson: true },
    });
    if (!grant || !grant.active) {
      throw new Error("Selected grant does not exist or is inactive");
    }

    const eligibility = evaluateHouseholdEligibility(
      input.household,
      parseRuleSet(grant.rulesJson),
    );
    const status = eligibility.eligible
      ? ApplicationStatus.SUBMITTED
      : ApplicationStatus.NEEDS_VERIFICATION;

    const application = await tx.application.create({
      data: {
        requestId: input.requestId,
        memberId: input.memberId,
        grantId: grant.id,
        status,
        matchScore: eligibility.matchScore,
        diagnosticsJson: {
          eligible: eligibility.eligible,
          fplThresholdCents: eligibility.fplThresholdCents,
          incomeRatioToFpl: eligibility.incomeRatioToFpl,
          disqualificationReasons: eligibility.disqualificationReasons,
          missingVerifications: eligibility.missingVerifications,
        },
        payloadHash,
      },
      select: { id: true, requestId: true, status: true },
    });

    const outboxEvent = await tx.outboxEvent.create({
      data: {
        aggregateType: "Application",
        aggregateId: application.id,
        eventType: "application.submitted",
        status: OutboxStatus.PENDING,
        payloadJson: {
          applicationId: application.id,
          requestId: application.requestId,
          grantId: grant.id,
          grantCode: grant.code,
          status: application.status,
          eligible: eligibility.eligible,
          matchScore: eligibility.matchScore,
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorType: "MEMBER",
        actorId: input.memberId,
        action: "APPLICATION_SUBMITTED",
        resourceType: "Application",
        resourceId: application.id,
        metadataJson: {
          requestId: application.requestId,
          grantId: grant.id,
          status: application.status,
          matchScore: eligibility.matchScore,
        },
      },
    });

    return {
      applicationId: application.id,
      requestId: application.requestId,
      status: application.status,
      eligible: eligibility.eligible,
      matchScore: eligibility.matchScore,
      outboxEventId: outboxEvent.id,
    };
  });
}
