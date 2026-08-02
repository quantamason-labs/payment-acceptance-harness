import assert from "node:assert/strict";
import test from "node:test";
import {
  SettlementLedger,
  decimalToAtomic,
  signHmacSha256,
  validateSettlement,
  verifyHmacSha256,
  type AcceptancePolicy,
  type ExpectedPayment,
  type SettlementEvent,
} from "../src/core.js";

const policy: AcceptancePolicy = {
  cluster: "solana-mainnet",
  recipient: "11111111111111111111111111111111",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  requireFinalized: true,
};

const expected: ExpectedPayment = {
  orderId: "order-412",
  reference: "33333333333333333333333333333333",
  amount: "125.00",
};

function validEvent(overrides: Partial<SettlementEvent> = {}): SettlementEvent {
  return {
    eventId: "evt-412-paid",
    orderId: expected.orderId,
    signature: "2".repeat(88),
    reference: expected.reference,
    cluster: policy.cluster,
    recipient: policy.recipient,
    mint: policy.mint,
    amount: expected.amount,
    confirmationStatus: "finalized",
    ...overrides,
  };
}

test("converts exact decimal USDC amounts without floating point", () => {
  assert.equal(decimalToAtomic("125.00", 6), 125_000_000n);
});

test("refuses exponent notation", () => {
  assert.throws(() => decimalToAtomic("1e2", 6), /plain non-negative decimal/);
});

test("refuses excessive fractional precision", () => {
  assert.throws(() => decimalToAtomic("1.0000001", 6), /more than 6/);
});

test("valid settlement returns atomic amount", () => {
  assert.deepEqual(validateSettlement(validEvent(), expected, policy), {
    ok: true,
    atomicAmount: 125_000_000n,
  });
});

test("rejects wrong cluster", () => {
  const result = validateSettlement(
    validEvent({ cluster: "solana-devnet" }),
    expected,
    policy,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_cluster");
});

test("rejects wrong recipient", () => {
  const result = validateSettlement(
    validEvent({ recipient: "44444444444444444444444444444444" }),
    expected,
    policy,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_recipient");
});

test("rejects counterfeit mint", () => {
  const result = validateSettlement(
    validEvent({ mint: "55555555555555555555555555555555" }),
    expected,
    policy,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_mint");
});

test("rejects another order", () => {
  const result = validateSettlement(validEvent({ orderId: "order-999" }), expected, policy);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_order");
});

test("rejects wrong reference", () => {
  const result = validateSettlement(
    validEvent({ reference: "66666666666666666666666666666666" }),
    expected,
    policy,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_reference");
});

test("rejects partial payment", () => {
  const result = validateSettlement(validEvent({ amount: "124.99" }), expected, policy);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_amount");
});

test("rejects overpayment when exact amount is required", () => {
  const result = validateSettlement(validEvent({ amount: "125.01" }), expected, policy);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "wrong_amount");
});

test("rejects a merely confirmed transaction", () => {
  const result = validateSettlement(
    validEvent({ confirmationStatus: "confirmed" }),
    expected,
    policy,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "not_finalized");
});

test("accepts one settlement and treats an identical retry as duplicate", () => {
  const ledger = new SettlementLedger();
  assert.equal(ledger.accept(validEvent(), expected, policy).status, "accepted");
  assert.equal(ledger.accept(validEvent(), expected, policy).status, "duplicate");
  assert.equal(ledger.size, 1);
});

test("rejects an event id reused with different data", () => {
  const ledger = new SettlementLedger();
  ledger.accept(validEvent(), expected, policy);
  const result = ledger.accept(validEvent({ signature: "4".repeat(88) }), expected, policy);
  assert.deepEqual(result, {
    status: "rejected",
    code: "event_id_conflict",
    detail: "event id was already used with different settlement data",
  });
});

test("rejects a transaction signature reused for another order", () => {
  const ledger = new SettlementLedger();
  ledger.accept(validEvent(), expected, policy);
  const secondExpected = {
    orderId: "order-413",
    reference: "77777777777777777777777777777777",
    amount: "125.00",
  };
  const result = ledger.accept(
    validEvent({
      eventId: "evt-413-paid",
      orderId: secondExpected.orderId,
      reference: secondExpected.reference,
    }),
    secondExpected,
    policy,
  );
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "signature_reused");
});

test("rejects a reference reused for another order", () => {
  const ledger = new SettlementLedger();
  ledger.accept(validEvent(), expected, policy);
  const secondExpected = {
    orderId: "order-413",
    reference: expected.reference,
    amount: "125.00",
  };
  const result = ledger.accept(
    validEvent({
      eventId: "evt-413-paid",
      orderId: secondExpected.orderId,
      signature: "4".repeat(88),
    }),
    secondExpected,
    policy,
  );
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "reference_reused");
});

test("verifies a correct HMAC signature with optional prefix", () => {
  const raw = '{"id":"evt-1"}';
  const signature = signHmacSha256(raw, "secret");
  assert.equal(verifyHmacSha256(raw, signature, "secret"), true);
  assert.equal(verifyHmacSha256(raw, `sha256=${signature}`, "secret"), true);
});

test("rejects malformed or incorrect HMAC signatures", () => {
  const raw = '{"id":"evt-1"}';
  assert.equal(verifyHmacSha256(raw, "not-hex", "secret"), false);
  assert.equal(verifyHmacSha256(raw, "0".repeat(64), "secret"), false);
});
