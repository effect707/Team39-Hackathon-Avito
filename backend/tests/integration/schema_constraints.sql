BEGIN;

INSERT INTO queue_entries (id, product_id, user_id, ticket_no, status)
VALUES (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    100,
    'WAITING'
);

DO $test$
BEGIN
    BEGIN
        INSERT INTO queue_entries (id, product_id, user_id, ticket_no, status)
        VALUES (
            '30000000-0000-4000-8000-000000000002',
            '10000000-0000-4000-8000-000000000001',
            '40000000-0000-4000-8000-000000000001',
            101,
            'WAITING'
        );
        RAISE EXCEPTION 'active queue entry uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END
$test$;

DO $test$
BEGIN
    BEGIN
        INSERT INTO queue_entries (id, product_id, user_id, ticket_no, status)
        VALUES (
            '30000000-0000-4000-8000-000000000003',
            '10000000-0000-4000-8000-000000000001',
            '40000000-0000-4000-8000-000000000002',
            100,
            'WAITING'
        );
        RAISE EXCEPTION 'product ticket uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END
$test$;

INSERT INTO purchase_grants (
    id,
    queue_entry_id,
    product_id,
    inventory_unit_id,
    user_id,
    status,
    expires_at
) VALUES (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'ACTIVE',
    now() + interval '5 minutes'
);

DO $test$
BEGIN
    BEGIN
        INSERT INTO purchase_grants (
            id,
            queue_entry_id,
            product_id,
            inventory_unit_id,
            user_id,
            status,
            expires_at
        ) VALUES (
            '50000000-0000-4000-8000-000000000002',
            '30000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001',
            '40000000-0000-4000-8000-000000000001',
            'CHECKOUT_PENDING',
            now() + interval '5 minutes'
        );
        RAISE EXCEPTION 'active inventory grant uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END
$test$;

ROLLBACK;
