-- 1. Asegurar que PostGIS está instalado
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Eliminar tabla de telemetría existente si la hubiera (de pruebas anteriores)
DROP TABLE IF EXISTS telemetry CASCADE;

-- 3. Crear la tabla particionada (reemplaza a la tabla creada por Prisma)
CREATE TABLE telemetry (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    avl_user_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    location geography(POINT, 4326),
    speed_kmh DECIMAL(6, 2),
    heading_degrees SMALLINT,
    ignition BOOLEAN,
    altitude_meters DECIMAL(8, 2),
    odometer_km DECIMAL(10, 2),
    battery_pct DECIMAL(5, 2),
    temperature_c DECIMAL(6, 2),
    humidity_pct DECIMAL(5, 2),
    direction_label VARCHAR(10),
    provider_code VARCHAR(50),
    event_type VARCHAR(100),
    is_duplicate BOOLEAN DEFAULT false NOT NULL,
    raw_payload JSONB NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- 4. Crear índices para la tabla particionada
CREATE INDEX idx_telemetry_tenant_vehicle_time ON telemetry(tenant_id, vehicle_id, timestamp DESC);
CREATE INDEX idx_telemetry_time ON telemetry(timestamp DESC);
CREATE INDEX idx_telemetry_location ON telemetry USING GIST (location);

-- 5. Crear la partición del mes actual (y el mes próximo para prevenir errores)
DO $$
DECLARE
    current_month_start DATE := date_trunc('month', CURRENT_DATE);
    next_month_start DATE := current_month_start + INTERVAL '1 month';
    next_next_month_start DATE := next_month_start + INTERVAL '1 month';
    partition_name_current TEXT;
    partition_name_next TEXT;
BEGIN
    partition_name_current := 'telemetry_' || to_char(current_month_start, 'YYYY_MM');
    partition_name_next := 'telemetry_' || to_char(next_month_start, 'YYYY_MM');
    
    -- Crear partición actual
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF telemetry FOR VALUES FROM (%L) TO (%L);',
        partition_name_current, current_month_start, next_month_start
    );
    
    -- Crear partición próxima
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF telemetry FOR VALUES FROM (%L) TO (%L);',
        partition_name_next, next_month_start, next_next_month_start
    );
END $$;
