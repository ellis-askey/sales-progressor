-- Remove unique-name constraint from BrokerFirm.
-- Brokers are per-agency partners, not a shared catalogue.
-- Two agencies may legitimately use a broker with the same firm name.
DROP INDEX IF EXISTS "BrokerFirm_name_key";
