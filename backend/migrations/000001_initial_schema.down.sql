DROP TABLE IF EXISTS checkout_attempts;

ALTER TABLE IF EXISTS inventory_units
    DROP CONSTRAINT IF EXISTS inventory_units_current_grant_id_fkey;

DROP TABLE IF EXISTS purchase_grants;
DROP TABLE IF EXISTS queue_entries;
DROP TABLE IF EXISTS inventory_units;
DROP TABLE IF EXISTS products;
