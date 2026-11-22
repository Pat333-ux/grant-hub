# grant-hub

Unified grant management API and standalone TypeScript eligibility-matching engine. This repository is a development scaffold; provider adapters are simulated.

## Features

- Rules-based household eligibility scoring.
- RSA-SHA256 signed application requests with timestamp checks and per-member nonce replay protection.
- BullMQ/Redis background queues and HMAC-SHA256 provider webhook verification.
- PostgreSQL persistence schema and lease-based transactional outbox foundation (Prisma).
- Adapter interfaces for federal, state, municipal, emergency, and foundation providers (currently simulated).

## Run locally

Requires Node.js 18+ and Docker Compose.

1. Copy `.env.example` to `.env`; replace the example webhook secrets with independent random values.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate the Prisma client and apply migrations with `npm run prisma:generate` and `npm run prisma:migrate` (after creating a migration for the schema).
5. Run `npm run dev`.
6. Build and test with `npm test`; run compiled output with `npm start`.

## API

- `GET /health`
- `POST /v1/members/register` — register a member's **client-generated public key**; the private key must remain with the member.
- `GET /v1/grants/active`
- `POST /v1/matching/evaluate`
- `POST /v1/applications/submit-signed`
- `GET /v1/members/:memberId/applications`
- `POST /v1/webhooks/providers` — raw request body is HMAC verified using `X-Grant-Provider-Signature`.

To sign a request, the client signs the UTF-8 bytes of the recursively key-sorted JSON payload with RSA-SHA256. The payload must include `requestId`, `memberId`, millisecond `timestamp`, unique `nonce`, `selectedGrantIds`, and `applicant`.

## Persistence and outbox

`PrismaOutboxStore` claims available events in PostgreSQL using `FOR UPDATE SKIP LOCKED`, sets a worker lease, and recovers expired `PROCESSING` leases. Failed delivery is rescheduled with exponential backoff; attempts at or above `maxAttempts` transition to `DEAD_LETTER`. Outbox payloads should contain only redacted metadata. Persist application changes and corresponding outbox events within the same database transaction when wiring this store into the application flow.

The Prisma schema is in `prisma/schema.prisma`. Create and commit a Prisma migration before using `prisma migrate deploy` in an environment.

## Before production

Complete API persistence wiring, identity/access controls, consent and data minimization, audit/retention policies, key lifecycle/revocation, rate limits, provider integration and operational monitoring. Eligibility rules and FPL values require review against current official program guidance before use; matching output is informational and is not an eligibility determination.
