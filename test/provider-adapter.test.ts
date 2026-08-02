import assert from "node:assert/strict";
import test from "node:test";
import { AdapterError, adaptExampleProviderWebhook } from "../src/provider-adapter.js";

const validPayload = {
  id: "evt-1",
  payment: {
    order_id: "order-1",
    transaction_signature: "2".repeat(88),
    reference: "3".repeat(32),
    cluster: "solana-mainnet",
    recipient: "1".repeat(32),
    mint: "4".repeat(32),
    amount: "10.00",
    confirmation_status: "finalized",
  },
};

test("normalizes the example provider payload", () => {
  assert.deepEqual(adaptExampleProviderWebhook(validPayload), {
    eventId: "evt-1",
    orderId: "order-1",
    signature: "2".repeat(88),
    reference: "3".repeat(32),
    cluster: "solana-mainnet",
    recipient: "1".repeat(32),
    mint: "4".repeat(32),
    amount: "10.00",
    confirmationStatus: "finalized",
  });
});

test("fails closed when provider fields are missing", () => {
  assert.throws(
    () => adaptExampleProviderWebhook({ id: "evt-1", payment: {} }),
    AdapterError,
  );
});

test("fails closed on an unsupported cluster", () => {
  assert.throws(
    () =>
      adaptExampleProviderWebhook({
        ...validPayload,
        payment: { ...validPayload.payment, cluster: "ethereum-mainnet" },
      }),
    /unsupported/,
  );
});
