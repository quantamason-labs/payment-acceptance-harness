# Client customization checklist

## Inputs required

- One provider API or checkout flow.
- Official webhook event schema and signature specification.
- Target Solana cluster.
- Exact merchant recipient and accepted mint.
- Token decimals and amount rules.
- Order identifier and payment-reference lifecycle.
- Definition of final settlement.
- Merchant fulfillment action and persistence technology.

Never request a seed phrase or private key. A webhook signing secret belongs in the client's secret manager and should not be committed or sent by ordinary email.

## Acceptance matrix

| Case | Expected result |
| --- | --- |
| Authentic, finalized, exact settlement | Accept once |
| Identical webhook retry | Return duplicate; do not fulfill again |
| Invalid HMAC | Reject before parsing or processing |
| Wrong cluster | Reject |
| Wrong recipient | Reject |
| Wrong mint | Reject |
| Partial or excess amount | Reject or route to explicit exception policy |
| Unfinalized transaction | Keep pending; do not fulfill |
| Reused transaction for another order | Reject |
| Reused payment reference for another order | Reject |
| Out-of-order event | Reconcile from persisted state; never regress a paid order |
| Provider timeout after delivery | Safe retry through idempotency keys |

## Production handoff

- Provider adapter and fixtures committed.
- Database uniqueness constraints reviewed.
- Raw-body signature verification confirmed in the chosen framework.
- Structured logs contain order IDs but no secrets.
- Alerting covers signature failures and repeated conflicts.
- Replay run demonstrates exactly one fulfillment.
- README and recorded walkthrough delivered.
- Client confirms acceptance criteria in writing.
