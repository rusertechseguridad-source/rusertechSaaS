-- ═══════════════════════════════════════════════════════════════════════════
-- ETAPA 3B · LAS CONDICIONES NÚCLEO
-- Base: rudaqsfgjorryuqayqyd (PostgreSQL 17.6)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ NO EJECUTADO POR EL AGENTE. Lo ejecuta Gustavo.
-- ⚠️ Sin metacomandos de psql y SIN bloques `DO $$` — el editor de Supabase los
--    rompe: toma las variables `record` por tablas y les inyecta un ALTER TABLE
--    adentro del bloque. Regla que salió de aplicar la 3A.
--
-- ⚠️ ESTE ARCHIVO VIVE EN EL REPOSITORIO, no sólo en el ZIP, y es a propósito:
--    `umbrales-condiciones.spec.ts` LO LEE y compara los DEFAULT de abajo
--    contra las constantes del código. Si alguien cambia uno de los dos lados,
--    la suite falla y dice cuál. Es la lección de la tolerancia del recorrido —
--    un comentario que dice «tiene que coincidir» no impide que se separen.
--
-- ── QUÉ HACE ──────────────────────────────────────────────────────────────
--   §1  los dos umbrales que faltaban, en `tenant_engine_config`
--   §2  el índice que le falta a la consulta del motor (los otros YA ESTÁN)
--   §3  VERIFICACIÓN (solo lectura)
--
-- ── LO QUE NO HACE ────────────────────────────────────────────────────────
--   · NO toca `trip_conditions` salvo agregarle UN índice, con nombre nuevo.
--   · NO crea ningún índice único: el que hacía falta YA EXISTE. Ver §2.
--   · NO toca nada de la 3A.
--   · NO carga datos. El contexto de prueba lo carga `32_`, que también lo borra.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §0 · PRE-VUELO — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ ESTAS TRES YA SE CORRIERON y el resultado cambió el §2 de este script.
-- Se dejan igual, por dos razones: son de sólo lectura, y volver a correrlas
-- ANTES de aplicar deja la foto del «antes» pegada al lado del «después» del §3.
--
-- Lo que contestaron:
--   §0.a  El cliente demo tiene parada_minutos 10 · parada_velocidad_kmh 5 ·
--         red_seguridad_minutos 30 · recorrido_tolerancia_m 2.00.
--         ⚠️ DOS METROS. Queda confirmado que `recorrido_tolerancia_m` NO es el
--         corredor de desvío —con dos metros, todo punto sería un desvío—: es
--         la tolerancia de simplificación del recorrido guardado. El corredor
--         sale de `trips.corridor_meters`. Era la lección que había que no
--         repetir y esta vez se midió antes de escribir el evaluador.
--   §0.b  `trip_conditions.origen` acepta 'motor', 'app' y 'ambas'.
--         El evaluador escribe 'motor': está adentro del CHECK.
--   §0.c  Los índices. Es el que más cambió las cosas — ver §2.

-- Qué umbrales tiene hoy cada cliente. ESPERADO: las columnas nuevas todavía no
-- existen; después de §1 aparecen con su default.
select '§0.a · configuración del motor por cliente' as bloque, *
from tenant_engine_config;

-- ⚠️ EL QUE MÁS ME IMPORTA: qué acepta `trip_conditions.origen`.
-- El evaluador escribe 'motor'. Eso ya está PROBADO en producción —el script
-- 30_ de la 3A insertó dos condiciones con ese valor y funcionó— pero conviene
-- ver el CHECK completo antes de que la 3C agregue otros orígenes.
select '§0.b · restricciones' as bloque, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid in ('trip_conditions'::regclass, 'tenant_engine_config'::regclass)
order by conname;

-- Qué índices tiene `trip_conditions`. Esta consulta es la que salvó la etapa:
-- ver §2, donde está lo que encontró y por qué cambió lo que el script crea.
select '§0.c · índices' as bloque, indexname, indexdef
from pg_indexes
where tablename = 'trip_conditions'
order by indexname;


-- ═══════════════════════════════════════════════════════════════════════════
-- §1 · LOS DOS UMBRALES QUE FALTABAN
-- ═══════════════════════════════════════════════════════════════════════════
-- De las cuatro condiciones de esta etapa, dos ya tenían dónde configurarse y
-- dos no:
--
--   PARADA_NO_AUTORIZADA  →  parada_minutos, parada_velocidad_kmh   ya estaban
--   DESVIO_DE_RUTA        →  trips.corridor_meters                  ya estaba
--   PARADA_PROLONGADA     →  ⛔ en ningún lado
--   SIN_REPORTE           →  ⛔ no por cliente
--
-- ⚠️ `PARADA_PROLONGADA` debía salir de `event_rules.duration_seconds` según el
-- diseño §6.4. Esa tabla está vacía A PROPÓSITO y su comentario lo dice: «No
-- hay evaluador de reglas todavía: llega en la Etapa 4. No cargar filas a mano
-- - nada las leeria». Así que su umbral entra acá, con el mismo patrón que los
-- cuatro que ya viven en esta tabla.
--
-- ⚠️ Y NO se usa `motor_valores_contexto.umbral_minutos` para SIN_REPORTE
-- aunque sea exactamente la pregunta «cuántos minutos sin punto»: ese catálogo
-- es GLOBAL (no tiene tenant_id) y alimenta `gps_reporting`, que es un insumo
-- del evaluador de protocolos de la Etapa 6. Una empresa de reparto urbano y
-- una de larga distancia no comparten criterio, y atar los dos haría que
-- cambiar la alerta cambiara la matriz de protocolos.

alter table tenant_engine_config
  add column if not exists sin_reporte_minutos smallint not null default 20;

alter table tenant_engine_config
  add column if not exists parada_prolongada_minutos smallint not null default 60;

comment on column tenant_engine_config.sin_reporte_minutos is
  'Minutos de silencio a partir de los cuales el motor abre SIN_REPORTE. Una zona de no_signal_zones puede AMPLIARLO (nunca reducirlo). El default de esta columna esta espejado en umbrales-condiciones.ts y una prueba falla si se separan.';

comment on column tenant_engine_config.parada_prolongada_minutos is
  'Minutos detenido a partir de los cuales el motor abre PARADA_PROLONGADA. A diferencia de PARADA_NO_AUTORIZADA, se abre AUN EN UBICACION HABILITADA: una hora quieto en la estacion de servicio ya no es cargar combustible.';

-- Los CHECK, con el patrón `drop … if exists` + `add` que reemplaza al `DO`.
-- Idempotente: correrlo dos veces deja la misma restricción.
alter table tenant_engine_config
  drop constraint if exists chk_tec_sin_reporte_minutos;
alter table tenant_engine_config
  add constraint chk_tec_sin_reporte_minutos
  check (sin_reporte_minutos between 5 and 720);

-- ⚠️ El piso es 5 y no 1: un umbral de un minuto convertiría cualquier bache de
-- transmisión en una alerta, y el operador dejaría de mirarlas. El techo de 720
-- (12 h) es para que un valor cargado por error no apague la condición del todo.
alter table tenant_engine_config
  drop constraint if exists chk_tec_parada_prolongada;
alter table tenant_engine_config
  add constraint chk_tec_parada_prolongada
  check (parada_prolongada_minutos between 5 and 1440);

-- ⚠️ NO se agrega un CHECK `parada_prolongada_minutos >= parada_minutos`,
-- aunque conceptualmente corresponda: un CHECK entre columnas se evalúa sobre
-- las filas EXISTENTES al crearlo, y si algún cliente ya tuviera
-- `parada_minutos` mayor que 60 el ALTER fallaría y dejaría la etapa a medio
-- aplicar. La relación la comprueba el evaluador, que puede explicarla en
-- castellano en vez de devolver un 23514.


-- ═══════════════════════════════════════════════════════════════════════════
-- §2 · LOS ÍNDICES — MEDIDOS, NO SUPUESTOS
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ ESTE BLOQUE SE REESCRIBIÓ DESPUÉS DE LEER `pg_indexes`. Lo que estaba
-- escrito antes de medir hacía dos cosas mal, y las dos EN SILENCIO:
--
--   a) Creaba `uq_trip_conditions_clave_identidad` sobre
--      (tenant_id, clave_identidad).
--      YA EXISTE `uq_trip_conditions_identidad`, UNIQUE sobre `clave_identidad`
--      SOLA — y es MÁS ESTRICTO que el que yo proponía: exige unicidad global,
--      no por cliente. Como la clave lleva el tenant adentro (ver
--      `tipos-condiciones.ts`), cumple exactamente la misma función. El
--      compuesto sería redundante. NO SE CREA.
--
--      Con eso, la ventana de carrera entre dos workers ya está cerrada por un
--      índice que estaba puesto desde antes de esta etapa.
--
--      ⚠️ Y de paso: no haber usado `ON CONFLICT (tenant_id, clave_identidad)`
--      resultó ser lo correcto. Ese índice no existe. El ON CONFLICT habría
--      fallado EN EJECUCIÓN, en producción, con la suite entera en verde.
--
--   b) Creaba `idx_trip_conditions_abiertas` sobre (tenant_id, vehicle_id, tipo)
--      con `where fin is null`.
--      YA EXISTE UN ÍNDICE CON ESE NOMBRE EXACTO Y OTRA DEFINICIÓN:
--          btree (tenant_id, nivel_riesgo, inicio DESC) WHERE fin IS NULL
--      `create index if not exists` mira EL NOMBRE, no la definición. Habría
--      salteado la creación sin decir nada y yo habría dado por puesto un
--      índice que no estaba.
--
--      Es exactamente el género de error que caza R17: preguntar si existe algo
--      con cierto nombre no es preguntar si hace lo que tiene que hacer.
--
-- Por eso el único índice que falta se crea CON OTRO NOMBRE, y el §3.d lo
-- verifica COMPARANDO LA DEFINICIÓN, no el nombre.

-- El que el motor necesita en CADA punto: «¿qué tiene abierto ESTE vehículo?».
-- El que ya estaba ordena las abiertas del cliente por gravedad y fecha: sirve
-- al panel, no al evaluador. No lleva `vehicle_id`, así que la consulta del
-- motor tendría que recorrer todas las abiertas del cliente para quedarse con
-- las de un camión.
-- Parcial sobre `fin is null`: ocupa lo que ocupan las ABIERTAS, no el histórico.
create index if not exists idx_trip_conditions_vehiculo_tipo
  on trip_conditions (tenant_id, vehicle_id, tipo)
  where fin is null;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3 · VERIFICACIÓN — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════

select '§3.a · las dos columnas nuevas' as bloque,
       column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_name = 'tenant_engine_config'
  and column_name in ('sin_reporte_minutos', 'parada_prolongada_minutos')
order by column_name;

-- ⚠️ ESTE ES EL CONTROL QUE IMPORTA: los defaults tienen que ser EXACTAMENTE
-- los que el código espeja. Si estos números no son 20 y 60, la prueba
-- `umbrales-condiciones.spec.ts` está mintiendo o el script se editó a mano.
select '§3.b · defaults contra el código' as bloque,
       column_name,
       column_default,
       case
         when column_name = 'sin_reporte_minutos'       and column_default like '20%' then 'OK · coincide con UMBRAL_SIN_REPORTE_POR_DEFECTO'
         when column_name = 'parada_prolongada_minutos' and column_default like '60%' then 'OK · coincide con UMBRAL_PARADA_PROLONGADA_POR_DEFECTO'
         else '⚠️ NO COINCIDE con el default del código'
       end as resultado
from information_schema.columns
where table_name = 'tenant_engine_config'
  and column_name in ('sin_reporte_minutos', 'parada_prolongada_minutos')
order by column_name;

select '§3.c · los CHECK' as bloque, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'tenant_engine_config'::regclass
  and conname in ('chk_tec_sin_reporte_minutos', 'chk_tec_parada_prolongada')
order by conname;

-- ⚠️ POR DEFINICIÓN, NO POR NOMBRE — y con `left join` contra un `values` para
-- que la ausencia también devuelva fila. Dos formas de mentir que esta consulta
-- cierra: `if not exists` saltea en silencio si el nombre está tomado, y un
-- `where indexname = …` que no encuentra nada devuelve CERO FILAS, que a simple
-- vista se parece demasiado a «no hubo problemas».
select '§3.d · el índice nuevo, POR DEFINICIÓN' as bloque,
       v.esperado as indice,
       coalesce(i.indexdef, '(no existe)') as definicion_real,
       case
         when i.indexname is null then '⛔ NO SE CREÓ'
         when i.indexdef like '%(tenant_id, vehicle_id, tipo)%'
          and i.indexdef like '%WHERE (fin IS NULL)%'
           then 'OK · las tres columnas y el WHERE parcial'
         else '⛔ HAY UNO CON ESE NOMBRE PERO CON OTRA DEFINICIÓN'
       end as resultado
from (values ('idx_trip_conditions_vehiculo_tipo')) as v(esperado)
left join pg_indexes i
  on i.tablename = 'trip_conditions'
 and i.indexname = v.esperado;

-- Y el panorama entero, para que quede constancia de que los DOS índices que ya
-- estaban siguen con su definición original: este script no los tocó.
-- ESPERADO: `uq_trip_conditions_identidad` UNIQUE sobre (clave_identidad), e
-- `idx_trip_conditions_abiertas` sobre (tenant_id, nivel_riesgo, inicio DESC).
select '§3.d-bis · todos los índices de trip_conditions' as bloque,
       indexname, indexdef
from pg_indexes
where tablename = 'trip_conditions'
order by indexname;

-- Los cuatro códigos que esta etapa abre tienen que existir y estar activos.
-- ESPERADO: cuatro filas, las cuatro OK. Si alguna falta, no se corrió la
-- Etapa 0 y el evaluador no escribiría nada (su INSERT lee el catálogo).
select '§3.e · los cuatro códigos' as bloque,
       v.codigo,
       case when mt.codigo is null then '⚠️ NO ESTÁ EN EL CATÁLOGO'
            when not mt.is_active then '⚠️ inactivo'
            else 'OK · ' || mt.riesgo_default end as resultado
from (values ('PARADA_NO_AUTORIZADA'), ('PARADA_PROLONGADA'),
             ('DESVIO_DE_RUTA'), ('SIN_REPORTE')) as v(codigo)
left join motor_tipos_condicion mt on mt.codigo = v.codigo
order by v.codigo;
