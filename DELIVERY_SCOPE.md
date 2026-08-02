# Fixed 72-hour delivery scope

Price: **250 USDC**, split **125 USDC at kickoff** and **125 USDC after acceptance**.

## Included

- One provider and one Solana payment path.
- TypeScript schema adapter.
- Raw webhook HMAC verification when the provider exposes a signing contract.
- Exact cluster, recipient, mint, amount, order, reference, and finality rules.
- Idempotent fulfillment boundary with duplicate and replay fixtures.
- Automated acceptance tests.
- Configuration example and deployment notes.
- README and recorded handoff.
- One focused review after delivery.

## Acceptance

The delivery is accepted when the agreed happy-path fixture passes, every agreed negative-path fixture fails closed, a duplicate delivery produces one fulfillment, the test command passes, and the client can run the documented demo or integration test.

## Excluded unless added in writing

- Custody or key management.
- Wallet signing or transaction broadcasting.
- Smart-contract audits.
- Mainnet fund movement.
- Full checkout UI redesign.
- Provider pricing, legal, tax, or compliance advice.
- Additional payment providers or merchant flows.
