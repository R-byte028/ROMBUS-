# Testing Strategy

**Current status:** No application code or automated tests have been added yet.

## Required test layers

### Unit tests
- Request validation (amount, asset/network identifiers, recipient, expiry).
- Provider response parsing and validation.
- Status transition rules.
- Quote expiry and amount/precision handling.
- Idempotency key behavior.

### Integration tests
- Quote creation against the provider's supported test environment, if available.
- Persistence of requests, quotes, and transfer references.
- Status polling/callback processing.
- Authentication and authorization boundaries.

### End-to-end tests
- Create request → open checkout → obtain quote → display deposit instructions.
- Deposit → processing → verified destination settlement → completed.
- Expired quote/request → expired.
- Provider failure → failed.
- Duplicate callback/status event → no duplicate completion or side effect.
- Refresh/reopen checkout → persisted state remains consistent.

## Test evidence format

For each test, record:
- Test ID and date
- Environment (mock, provider test environment, or mainnet)
- Setup and sanitized input
- Expected result
- Actual result
- Pass/fail
- Relevant commit or CI run

Never label mocked behavior as a live provider integration.
