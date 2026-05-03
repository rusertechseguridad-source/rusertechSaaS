-- 1. Asegurar que pg_cron está instalado (Supabase lo tiene por defecto, pero requiere habilitarlo)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función para crear dinámicamente la partición del mes siguiente
CREATE OR REPLACE FUNCTION create_telemetry_partition()
RETURNS void AS $$
DECLARE
    next_month_start DATE := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    next_next_month_start DATE := next_month_start + INTERVAL '1 month';
    partition_name TEXT;
BEGIN
    partition_name := 'telemetry_' || to_char(next_month_start, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF telemetry FOR VALUES FROM (%L) TO (%L);',
        partition_name, next_month_start, next_next_month_start
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Programar el cron job para ejecutar el día 25 de cada mes a la 01:00 AM
SELECT cron.schedule(
    'rusertech-create-telemetry-partition',
    '0 1 25 * *',
    'SELECT create_telemetry_partition();'
);
