-- Erzeugt eine zweite Datenbank für die Vitest-Suite, die parallel zur Dev-DB
-- existiert. Wird nur beim ersten Start des Postgres-Containers ausgeführt
-- (Postgres ruft alle Skripte aus /docker-entrypoint-initdb.d genau einmal auf,
-- solange das Daten-Volume noch leer ist).

CREATE DATABASE turnier_test OWNER turnier;
