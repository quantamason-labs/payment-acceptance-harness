# QuantaMason Payment Acceptance Harness

A configurable TypeScript reference for the boundary between a Solana checkout provider and merchant fulfillment:

```text
invoice/order
    |
    v
provider webhook -- HMAC authenticity --> schema adapter
                                             |
                                             v
                                      exact policy checks
                                             |
                              reject <------+------> accept
                                                        |
                                             idempotency ledger
                                                        |
                                             fulfill exactly once
```

The harness handles no wallet secrets, signs no transactions, broadcasts nothing, and moves no funds. It validates settlement evidence supplied to a merchant integration and demonstrates the negative paths that prevent false or repeated fulfillment.

## Included

- Exact decimal-to-atomic conversion using `BigInt`.
- Constant-time HMAC-SHA256 verification over the raw webhook body.
- Provider-specific schema adapter boundary.
- Cluster, recipient, mint, order, reference, amount, and finality checks.
- Duplicate webhook tolerance.
- Cross-order transaction-signature and payment-reference reuse protection.
- Structured acceptance and rejection results.
- Automated tests and a deterministic demo.

## Run

Requirements: Node.js 20 or later.

```powershell
npm.cmd install
npm.cmd test
npm.cmd run demo
```

The demo should report one accepted fulfillment, one harmless duplicate retry, and a final fulfillment count of one.

## Customize for a client

1. Replace `adaptExampleProviderWebhook` with a mapping from the provider's documented webhook schema.
2. Load `AcceptancePolicy` from deployment configuration rather than source control.
3. Resolve `ExpectedPayment` from the merchant's order database.
4. Replace `SettlementLedger` with a database transaction and unique indexes on event ID, transaction signature, and payment reference.
5. Verify the provider signature against the exact raw request bytes before parsing JSON.
6. Add provider fixtures for retries, partial payments, stale events, and out-of-order delivery.
7. Keep signing, seed phrases, private keys, and custody outside this service.

See [CUSTOMIZATION_CHECKLIST.md](CUSTOMIZATION_CHECKLIST.md) for the implementation handoff and [DELIVERY_SCOPE.md](DELIVERY_SCOPE.md) for the fixed 72-hour commercial scope.

## Production boundary

This repository is an acceptance harness and reference implementation. Production adoption still requires the provider's official webhook contract, the merchant's persistence layer, deployment secrets, observability, and an agreed fulfillment transaction boundary.

## License

MIT.
