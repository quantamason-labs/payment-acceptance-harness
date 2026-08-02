import { readFileSync } from "node:fs";
import {
  SettlementLedger,
  signHmacSha256,
  verifyHmacSha256,
  type AcceptancePolicy,
  type ExpectedPayment,
} from "./core.js";
import { adaptExampleProviderWebhook } from "./provider-adapter.js";

const policy = JSON.parse(
  readFileSync(new URL("../../config/example.policy.json", import.meta.url), "utf8"),
) as AcceptancePolicy;

const expected: ExpectedPayment = {
  orderId: "order-412",
  reference: "33333333333333333333333333333333",
  amount: "125.00",
};

const payload = {
  id: "evt-412-paid",
  payment: {
    order_id: expected.orderId,
    transaction_signature: "2".repeat(88),
    reference: expected.reference,
    cluster: policy.cluster,
    recipient: policy.recipient,
    mint: policy.mint,
    amount: expected.amount,
    confirmation_status: "finalized",
  },
};

const rawBody = JSON.stringify(payload);
const secret = "demo-only-secret";
const signature = signHmacSha256(rawBody, secret);
const webhookAuthentic = verifyHmacSha256(rawBody, `sha256=${signature}`, secret);
const event = adaptExampleProviderWebhook(payload);
const ledger = new SettlementLedger();
const first = ledger.accept(event, expected, policy);
const retry = ledger.accept(event, expected, policy);

console.log(
  JSON.stringify(
    { webhookAuthentic, first, retry, fulfillmentCount: ledger.size },
    (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
