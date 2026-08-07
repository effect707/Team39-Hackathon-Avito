CREATE TABLE products (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    category TEXT NOT NULL CHECK (btrim(category) <> ''),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    queue_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (lifecycle_status IN ('ACTIVE', 'SOLD_OUT', 'REMOVED')),
    next_ticket BIGINT NOT NULL DEFAULT 1 CHECK (next_ticket > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_units (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD')),
    current_grant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE queue_entries (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL,
    ticket_no BIGINT NOT NULL CHECK (ticket_no > 0),
    status TEXT NOT NULL
        CHECK (status IN (
            'JOINING',
            'WAITING',
            'GRANTED',
            'CHECKOUT_PENDING',
            'PURCHASED',
            'EXPIRED',
            'PAYMENT_FAILED',
            'SOLD_OUT',
            'CANCELLED',
            'ERROR'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT queue_entries_product_ticket_key UNIQUE (product_id, ticket_no)
);

CREATE TABLE purchase_grants (
    id UUID PRIMARY KEY,
    queue_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    inventory_unit_id UUID NOT NULL REFERENCES inventory_units(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN (
            'ACTIVE',
            'CHECKOUT_PENDING',
            'PURCHASED',
            'EXPIRED',
            'FAILED',
            'CANCELLED'
        )),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inventory_units
    ADD CONSTRAINT inventory_units_current_grant_id_fkey
    FOREIGN KEY (current_grant_id)
    REFERENCES purchase_grants(id)
    ON DELETE SET NULL;

CREATE TABLE checkout_attempts (
    id UUID PRIMARY KEY,
    grant_id UUID NOT NULL REFERENCES purchase_grants(id) ON DELETE RESTRICT,
    idempotency_key UUID NOT NULL,
    payment_result TEXT NOT NULL
        CHECK (payment_result IN ('success', 'failure', 'timeout')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checkout_attempts_idempotency_key_key UNIQUE (idempotency_key)
);

CREATE INDEX inventory_units_product_status_idx
    ON inventory_units (product_id, status);

CREATE UNIQUE INDEX queue_entries_active_product_user_key
    ON queue_entries (product_id, user_id)
    WHERE status IN ('JOINING', 'WAITING', 'GRANTED', 'CHECKOUT_PENDING', 'ERROR');

CREATE INDEX queue_entries_waiting_fifo_idx
    ON queue_entries (product_id, ticket_no)
    WHERE status = 'WAITING';

CREATE INDEX purchase_grants_expiry_idx
    ON purchase_grants (expires_at)
    WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX purchase_grants_active_inventory_unit_key
    ON purchase_grants (inventory_unit_id)
    WHERE status IN ('ACTIVE', 'CHECKOUT_PENDING');

CREATE INDEX checkout_attempts_grant_id_idx
    ON checkout_attempts (grant_id);
