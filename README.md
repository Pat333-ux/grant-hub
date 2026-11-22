# grant-hub

Unified grant management API and standalone TypeScript eligibility-matching engine. This repository is a development scaffold: grant records and application state are in memory, and provider adapters simulate responses. It is not production-ready for real applications, benefits decisions, or personal data without persistent storage, security controls, and verified provider integrations.

## Features

- Rules-based household eligibility scoring.
- RSA-SHA256 signed application requests with timestamp checks and per-member nonce replay protection.
- BullMQ/Redis background queues and HMAC-SHA256 provider webhook verification.
- Adapter interfaces for federal, state, municipal, emergency, and foundation providers (currently simulated).

## Run locally

Requires Node.js 18+ and Docker Compose.

1. Copy `.env.example` to `.env` and set independent random secrets.
2. Start Redis with `docker compose up -d`.
3. Install and run: `npm install`, `npm run dev`.
4. Build: `npm run build`; run compiled output with `npm start`.

## API

- `GET /health`
- `POST /v1/members/register` — register a member's **client-generated public key**; the private key must remain with the member.
- `GET /v1/grants/active`
- `POST /v1/matching/evaluate`
- `POST /v1/applications/submit-signed`
- `GET /v1/members/:memberId/applications`
- `POST /v1/webhooks/providers` — raw request body is HMAC verified using `X-Grant-Provider-Signature`.

To sign a request, the client signs the UTF-8 bytes of the recursively key-sorted JSON payload with RSA-SHA256. The payload must include `requestId`, `memberId`, millisecond `timestamp`, unique `nonce`, `selectedGrantIds`, and `applicant`.

## Before production

Replace in-memory storage with durable transactional persistence; implement identity/access controls, consent and data minimization, audit/retention policies, key lifecycle/revocation, rate limits, secure secret management, webhook delivery/retry and idempotency, and real provider contracts. The sample provider adapters return simulated statuses and amounts. Have eligibility rules and legal/privacy requirements reviewed before use.
