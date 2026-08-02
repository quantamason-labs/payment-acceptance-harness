import { createHmac, timingSafeEqual } from "node:crypto";

export type SolanaCluster = "solana-mainnet" | "solana-devnet";

export interface AcceptancePolicy {
  cluster: SolanaCluster;
  recipient: string;
  mint: string;
  decimals: number;
  requireFinalized?: boolean;
}

export interface ExpectedPayment {
  orderId: string;
  reference: string;
  amount: string;
}

export interface SettlementEvent {
  eventId: string;
  orderId: string;
  signature: string;
  reference: string;
  cluster: SolanaCluster;
  recipient: string;
  mint: string;
  amount: string;
  confirmationStatus: "processed" | "confirmed" | "finalized";
}

export type RejectionCode =
  | "invalid_policy"
  | "invalid_event"
  | "wrong_cluster"
  | "wrong_recipient"
  | "wrong_mint"
  | "wrong_order"
  | "wrong_reference"
  | "wrong_amount"
  | "not_finalized"
  | "event_id_conflict"
  | "signature_reused"
  | "reference_reused";

export type ValidationResult =
  | { ok: true; atomicAmount: bigint }
  | { ok: false; code: RejectionCode; detail: string };

export type AcceptanceResult =
  | { status: "accepted"; eventId: string; orderId: string; atomicAmount: bigint }
  | { status: "duplicate"; eventId: string; orderId: string }
  | { status: "rejected"; code: RejectionCode; detail: string };

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const HEX_32_BYTES_RE = /^(?:sha256=)?[a-fA-F0-9]{64}$/;

export function decimalToAtomic(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("decimals must be an integer between 0 and 18");
  }

  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new Error("amount must be a plain non-negative decimal string");
  }

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new Error(`amount has more than ${decimals} fractional digits`);
  }

  const padded = fraction.padEnd(decimals, "0");
  const scale = 10n ** BigInt(decimals);
  return BigInt(whole) * scale + BigInt(padded || "0");
}

export function isPlausibleSolanaAddress(value: string): boolean {
  return value.length >= 32 && value.length <= 44 && BASE58_RE.test(value);
}

export function isPlausibleTransactionSignature(value: string): boolean {
  return value.length >= 64 && value.length <= 100 && BASE58_RE.test(value);
}

export function signHmacSha256(rawBody: string | Uint8Array, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyHmacSha256(
  rawBody: string | Uint8Array,
  providedSignature: string,
  secret: string,
): boolean {
  if (!secret || !HEX_32_BYTES_RE.test(providedSignature)) {
    return false;
  }

  const normalized = providedSignature.replace(/^sha256=/i, "").toLowerCase();
  const expected = Buffer.from(signHmacSha256(rawBody, secret), "hex");
  const provided = Buffer.from(normalized, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function validateSettlement(
  event: SettlementEvent,
  expected: ExpectedPayment,
  policy: AcceptancePolicy,
): ValidationResult {
  if (
    !isPlausibleSolanaAddress(policy.recipient) ||
    !isPlausibleSolanaAddress(policy.mint) ||
    !Number.isInteger(policy.decimals) ||
    policy.decimals < 0 ||
    policy.decimals > 18
  ) {
    return { ok: false, code: "invalid_policy", detail: "policy fields are malformed" };
  }

  if (
    !event.eventId ||
    !event.orderId ||
    !isPlausibleTransactionSignature(event.signature) ||
    !isPlausibleSolanaAddress(event.reference)
  ) {
    return { ok: false, code: "invalid_event", detail: "event identifiers are malformed" };
  }

  if (event.cluster !== policy.cluster) {
    return { ok: false, code: "wrong_cluster", detail: "event cluster does not match policy" };
  }
  if (event.recipient !== policy.recipient) {
    return { ok: false, code: "wrong_recipient", detail: "recipient does not match policy" };
  }
  if (event.mint !== policy.mint) {
    return { ok: false, code: "wrong_mint", detail: "mint does not match policy" };
  }
  if (event.orderId !== expected.orderId) {
    return { ok: false, code: "wrong_order", detail: "event is bound to another order" };
  }
  if (event.reference !== expected.reference) {
    return { ok: false, code: "wrong_reference", detail: "payment reference does not match order" };
  }
  if ((policy.requireFinalized ?? true) && event.confirmationStatus !== "finalized") {
    return { ok: false, code: "not_finalized", detail: "settlement is not finalized" };
  }

  try {
    const actualAtomic = decimalToAtomic(event.amount, policy.decimals);
    const expectedAtomic = decimalToAtomic(expected.amount, policy.decimals);
    if (actualAtomic !== expectedAtomic) {
      return { ok: false, code: "wrong_amount", detail: "settled amount is not exact" };
    }
    return { ok: true, atomicAmount: actualAtomic };
  } catch (error) {
    return {
      ok: false,
      code: "invalid_event",
      detail: error instanceof Error ? error.message : "invalid amount",
    };
  }
}

interface StoredSettlement {
  eventId: string;
  orderId: string;
  signature: string;
  reference: string;
}

export class SettlementLedger {
  readonly #byEventId = new Map<string, StoredSettlement>();
  readonly #orderBySignature = new Map<string, string>();
  readonly #orderByReference = new Map<string, string>();

  accept(
    event: SettlementEvent,
    expected: ExpectedPayment,
    policy: AcceptancePolicy,
  ): AcceptanceResult {
    const existingEvent = this.#byEventId.get(event.eventId);
    if (existingEvent) {
      if (
        existingEvent.orderId === event.orderId &&
        existingEvent.signature === event.signature &&
        existingEvent.reference === event.reference
      ) {
        return { status: "duplicate", eventId: event.eventId, orderId: event.orderId };
      }
      return {
        status: "rejected",
        code: "event_id_conflict",
        detail: "event id was already used with different settlement data",
      };
    }

    const validation = validateSettlement(event, expected, policy);
    if (!validation.ok) {
      return { status: "rejected", code: validation.code, detail: validation.detail };
    }

    const signatureOrder = this.#orderBySignature.get(event.signature);
    if (signatureOrder && signatureOrder !== event.orderId) {
      return {
        status: "rejected",
        code: "signature_reused",
        detail: "transaction signature was already bound to another order",
      };
    }

    const referenceOrder = this.#orderByReference.get(event.reference);
    if (referenceOrder && referenceOrder !== event.orderId) {
      return {
        status: "rejected",
        code: "reference_reused",
        detail: "payment reference was already bound to another order",
      };
    }

    const stored: StoredSettlement = {
      eventId: event.eventId,
      orderId: event.orderId,
      signature: event.signature,
      reference: event.reference,
    };
    this.#byEventId.set(event.eventId, stored);
    this.#orderBySignature.set(event.signature, event.orderId);
    this.#orderByReference.set(event.reference, event.orderId);

    return {
      status: "accepted",
      eventId: event.eventId,
      orderId: event.orderId,
      atomicAmount: validation.atomicAmount,
    };
  }

  get size(): number {
    return this.#byEventId.size;
  }
}
