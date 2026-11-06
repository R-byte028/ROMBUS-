# Technical Decisions

This document records decisions and the reasoning behind them. Update it when a decision changes.

## TD-001 — Product scope: payment infrastructure
**Decision:** Build payment requests and hosted checkout for cross-chain payments.

**Reason:** A focused payment flow demonstrates a concrete use case for Web3 users and developers. A generic marketplace or broad wallet would dilute the MVP.

## TD-002 — NEAR Intents 1Click as execution path
**Decision:** Investigate and integrate 1Click for supported routes.

**Reason:** It provides a quote/deposit/status model suitable for a payer-funded checkout. Exact API behavior must be verified against current documentation before implementation.

## TD-003 — Non-custodial payer authorization
**Decision:** The payer explicitly sends funds from a compatible wallet to the deposit address returned by the provider.

**Reason:** ROMBUS should not take custody of private keys or silently initiate payments.

## TD-004 — Settlement-based completion
**Decision:** Mark a payment completed only after destination settlement is verified.

**Reason:** A submitted transaction or deposit alone does not prove that the recipient received the requested output.

## TD-005 — Server-side provider integration
**Decision:** Keep provider credentials and privileged operations on the server.

**Reason:** Prevent secret exposure and centralize validation, idempotency, and status transition rules.

## TD-006 — MVP before advanced features
**Decision:** Prioritize payment requests, hosted checkout, live quotes, deposit instructions, and verified status tracking. Defer full SDKs and AI-agent payments.

**Reason:** A tested end-to-end path is more valuable to evaluators than multiple unfinished features.
