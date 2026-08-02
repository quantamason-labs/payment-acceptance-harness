# Validation record

Validated: 2 August 2026

Environment:

- Node.js 24.16.0
- TypeScript 7.0.2
- `@types/node` 26.1.2

## Build and tests

Command:

```powershell
npm.cmd test
```

Result: **21 tests passed, 0 failed**.

Coverage exercised:

- exact decimal arithmetic without floating point;
- rejection of exponent notation and excess precision;
- cluster, recipient, mint, order, reference, amount, and finality mismatches;
- exact settlement acceptance;
- identical webhook retry handling;
- event-ID conflicts;
- cross-order transaction-signature and payment-reference reuse;
- correct and incorrect HMAC-SHA256 verification;
- provider schema normalization and fail-closed malformed payload handling.

## Deterministic demo

Command:

```powershell
npm.cmd run demo
```

Observed result:

```json
{
  "webhookAuthentic": true,
  "first": {
    "status": "accepted",
    "eventId": "evt-412-paid",
    "orderId": "order-412",
    "atomicAmount": "125000000"
  },
  "retry": {
    "status": "duplicate",
    "eventId": "evt-412-paid",
    "orderId": "order-412"
  },
  "fulfillmentCount": 1
}
```

The demo uses deterministic fixtures, a demo-only webhook secret, and no network access. It signs no transaction and moves no funds.
