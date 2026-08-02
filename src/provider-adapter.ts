import type { SettlementEvent, SolanaCluster } from "./core.js";

type JsonRecord = Record<string, unknown>;

export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdapterError(`${field} must be an object`);
  }
  return value as JsonRecord;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AdapterError(`${field} must be a non-empty string`);
  }
  return value;
}

function cluster(value: unknown): SolanaCluster {
  if (value !== "solana-mainnet" && value !== "solana-devnet") {
    throw new AdapterError("payment.cluster is unsupported");
  }
  return value;
}

/**
 * Example normalization boundary. Replace only this function for a provider's
 * webhook schema; keep the policy and idempotency core provider-agnostic.
 */
export function adaptExampleProviderWebhook(payload: unknown): SettlementEvent {
  const root = record(payload, "payload");
  const payment = record(root.payment, "payment");

  return {
    eventId: text(root.id, "id"),
    orderId: text(payment.order_id, "payment.order_id"),
    signature: text(payment.transaction_signature, "payment.transaction_signature"),
    reference: text(payment.reference, "payment.reference"),
    cluster: cluster(payment.cluster),
    recipient: text(payment.recipient, "payment.recipient"),
    mint: text(payment.mint, "payment.mint"),
    amount: text(payment.amount, "payment.amount"),
    confirmationStatus: text(
      payment.confirmation_status,
      "payment.confirmation_status",
    ) as SettlementEvent["confirmationStatus"],
  };
}
