export type QueueEntryStatus =
    | "JOINING"
    | "WAITING"
    | "GRANTED"
    | "CHECKOUT_PENDING"
    | "PURCHASED"
    | "EXPIRED"
    | "PAYMENT_FAILED"
    | "SOLD_OUT"
    | "CANCELLED"
    | "ERROR";

export type GrantStatus =
    "ACTIVE" | "CHECKOUT_PENDING" | "PURCHASED" | "EXPIRED" | "FAILED" | "CANCELLED";

export interface Grant {
    id: string;
    product_id: string;
    inventory_unit_id: string;
    status: GrantStatus;
    expires_at: string;
}

export interface QueueState {
    queue_entry_id: string;
    product_id: string;
    ticket_no: number;
    status: QueueEntryStatus;
    position?: number | null;
    message: string;
    next_action: string;
    grant?: Grant | null;
}

export interface SSESignal {
    type: "queue.changed";
    product_id: string;
    queue_entry_id: string;
    occurred_at: string;
}

export interface PaymentResultRequest {
    idempotency_key: string;
    result: "success" | "failure" | "timeout";
}

export interface PaymentResultResponse {
    queue_state: QueueState;
}

export interface ErrorEnvelope {
    error: { code: string; message: string; request_id: string };
}
