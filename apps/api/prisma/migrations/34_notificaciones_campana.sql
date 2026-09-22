-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICACIONES · 1 — LO QUE LA CAMPANA NECESITA EN LA BASE
-- Base: rudaqsfgjorryuqayqyd (PostgreSQL 17.6)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ NO EJECUTADO POR EL AGENTE. Lo ejecuta Gustavo.
-- ⚠️ Sin metacomandos de psql y SIN bloques `DO $$` — el editor de Supabase
--    los rompe. Regla que salió de aplicar la 3A.
-- ⚠️ CORRER ESTE SCRIPT **ANTES** DE DESPLEGAR EL CÓDIGO. La campana lee dos
--    columnas que hoy no existen; sin el script, la API arranca y la consulta
--    de pendientes falla con «column nr.interrumpe_al_operador does not exist».
--
-- ── POR QUÉ HAY COLUMNAS NUEVAS, SI PEDISTE NO INVENTAR NADA ──────────────
--
-- Medí el catálogo antes de escribir una línea, y lo que encontré NO ALCANZA:
--
--   codigo               orden  requiere_atencion_operador  color
--   panorama_normal        10            false              #2BF4B6
--   anomalia               20            TRUE               #F59E0B
--   riesgo_critico         30            TRUE               #EF4444
--   activacion_policial    40            TRUE               #B91C1C
--
-- `requiere_atencion_operador` es TRUE en TRES de los cuatro niveles. Sirve
-- perfecto para «¿esto entra a la campana?» —deja afuera a panorama_normal,
-- que es donde viven PERNOCTE y CARGA_COMBUSTIBLE, estados declarados y no
-- alertas— pero NO puede ser la línea entre crítica y menor: si lo fuera, una
-- parada no autorizada (anomalía) dispararía el aviso rojo con sirena.
--
-- Son DOS preguntas distintas y el catálogo sólo contesta una. La otra no la
-- puede contestar `orden >= 30` en el código, que es exactamente lo que
-- prohibiste y con razón: el día que quieras que una anomalía despierte a
-- alguien, habría que tocar código y desplegar.
--
-- Así que se agrega la columna que falta. No es vocabulario nuevo: es un
-- atributo más en el catálogo que ya lleva color, SLA y atención, y se cambia
-- con un UPDATE — incluso por cliente, porque la tabla admite `tenant_id`.
--
-- ── QUÉ HACE ──────────────────────────────────────────────────────────────
--   §0  PRE-VUELO (solo lectura)
--   §1  las dos columnas nuevas en `motor_niveles_riesgo`
--   §2  los valores — la decisión, que es tuya y se cambia acá
--   §3  el índice que le falta a `event_logs`
--   §4  VERIFICACIÓN (solo lectura)
--
-- ── LO QUE NO HACE ────────────────────────────────────────────────────────
--   · NO crea ninguna tabla de notificaciones. La campana ES una consulta
--     sobre `trip_conditions` y `event_logs`; una tabla intermedia sería un
--     tercer lugar donde el estado se puede desincronizar.
--   · NO toca `trip_conditions`: `atendida_por`, `atendida_at` y `nota` ya
--     existen. Verificado.
--   · NO toca el catálogo de tipos de condición ni los permisos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §0 · PRE-VUELO — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- El catálogo tal como está. Después del §2, `interrumpe_al_operador` tiene
-- que quedar en true SOLO en riesgo_critico y activacion_policial.
select '§0.a · niveles de riesgo, hoy' as bloque,
       codigo, orden, color, requiere_atencion_operador, sla_minutos, tenant_id
from motor_niveles_riesgo
order by orden;

-- ⚠️ `event_logs.severity` NO TIENE CHECK — lo verifiqué. Es un varchar libre.
-- Hoy el único valor que existe es `critical`, y el §2 lo mapea. Si acá
-- aparece otro valor, decímelo: ese mapeo también va en el catálogo y no en
-- el código. Mientras tanto, un valor sin mapear entra a la campana igual,
-- marcado «sin clasificar», y NO interrumpe.
select '§0.b · severidades que existen en event_logs' as bloque,
       severity, status, count(*) as cuantos
from event_logs
group by severity, status
order by severity, status;

-- Las tres columnas de atención que la campana escribe. ESPERADO: las tres.
select '§0.c · columnas de atención' as bloque,
       column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'trip_conditions'
  and column_name in ('atendida_por', 'atendida_at', 'nota')
order by column_name;

-- Los índices de las dos tablas que la campana consulta.
-- ⚠️ Mirá `idx_trip_conditions_sla`: es parcial sobre
-- `(fin IS NULL AND atendida_at IS NULL)`, que es EXACTAMENTE el predicado de
-- «pendiente». Ya estaba, de quien diseñó el SLA. Por eso este script no crea
-- ningún índice sobre `trip_conditions`: el que hacía falta está puesto.
select '§0.d · índices' as bloque, tablename, indexname, indexdef
from pg_indexes
where tablename in ('trip_conditions', 'event_logs')
order by tablename, indexname;


-- ═══════════════════════════════════════════════════════════════════════════
-- §1 · LAS DOS COLUMNAS QUE FALTAN
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.a · ¿Este nivel CORTA LA PANTALLA del operador?
--
-- ⚠️ El default es `false` a propósito, y es el fallo seguro que corresponde
-- acá: un nivel nuevo que alguien agregue mañana entra a la campana (si marca
-- `requiere_atencion_operador`) pero no dispara la sirena hasta que alguien lo
-- decida a conciencia. Al revés —default true— un código agregado sin pensar
-- despertaría a un operador a las 3 de la mañana, y la segunda vez que pase la
-- campana se silencia para siempre.
alter table motor_niveles_riesgo
  add column if not exists interrumpe_al_operador boolean not null default false;

comment on column motor_niveles_riesgo.interrumpe_al_operador is
  'Si es true, una alerta de este nivel muestra el aviso rojo sobre la pantalla y suena hasta que alguien la atienda. Si es false, entra a la lista de la campana con un sonido corto. NO confundir con requiere_atencion_operador, que decide si entra a la campana: son dos preguntas distintas.';

-- 1.b · Cómo se traduce `event_logs.severity` a este nivel.
--
-- ⚠️ Existe porque son DOS FUENTES DE ALERTAS con dos vocabularios. Las
-- condiciones del motor usan los códigos de esta tabla; las alertas de
-- geocerca y pánico usan `event_logs.severity`, que es un varchar sin CHECK.
-- La traducción vive acá y no en el código por la misma razón que todo lo
-- demás: un valor nuevo en esa columna se resuelve con un UPDATE.
alter table motor_niveles_riesgo
  add column if not exists severidad_evento varchar(30);

comment on column motor_niveles_riesgo.severidad_evento is
  'Valor de event_logs.severity que corresponde a este nivel de riesgo. Permite que la campana muestre las alertas del motor de geocercas con la misma gravedad que las condiciones. Una severidad sin fila acá entra a la campana marcada como sin clasificar y no interrumpe.';

-- ⚠️ El índice único evita que dos niveles reclamen la misma severidad: con
-- dos filas, el LEFT JOIN de la campana duplicaría cada alerta de geocerca.
-- Parcial sobre `not null` porque la mayoría de los niveles no mapea ninguna.
create unique index if not exists uq_motor_niveles_severidad_evento
  on motor_niveles_riesgo (severidad_evento)
  where severidad_evento is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2 · LOS VALORES — LA DECISIÓN, QUE ES TUYA
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ ESTO ES LO ÚNICO QUE DEFINE QUÉ ES «CRÍTICO». No hay un número en el
-- código. Si mañana querés que una anomalía también interrumpa, es un UPDATE
-- sobre una fila y la próxima alerta ya lo respeta, sin desplegar nada.
--
-- Lo que propongo, y por qué:
--
--   riesgo_critico       → SÍ interrumpe. Acá viven SIN_REPORTE, DESVIO_DE_RUTA,
--                          TEMPERATURA_FUERA_DE_RANGO, ZONA_RIESGOSA, SINIESTRO.
--   activacion_policial  → SÍ interrumpe. SOS y ABANDONO_CARGA.
--   anomalia             → NO. PARADA_NO_AUTORIZADA, PARADA_PROLONGADA,
--                          VELOCIDAD_EXCESIVA, las demoras. Entran a la campana
--                          con un sonido corto, que es lo que pediste para las
--                          menores.
--   panorama_normal      → NO, y además no entra a la campana: son estados
--                          declarados (PERNOCTE, CARGA_COMBUSTIBLE).
--
-- Con esto, de las cuatro condiciones que el motor abre hoy: SIN_REPORTE y
-- DESVIO_DE_RUTA interrumpen; PARADA_NO_AUTORIZADA y PARADA_PROLONGADA no.

update motor_niveles_riesgo
   set interrumpe_al_operador = true
 where codigo in ('riesgo_critico', 'activacion_policial');

update motor_niveles_riesgo
   set interrumpe_al_operador = false
 where codigo in ('panorama_normal', 'anomalia');

-- La única severidad que existe hoy en `event_logs`, mapeada al nivel que le
-- corresponde. Las tres filas que hay son `panic_button` con severidad
-- `critical`: un botón de pánico tiene que interrumpir.
update motor_niveles_riesgo
   set severidad_evento = 'critical'
 where codigo = 'riesgo_critico';


-- ═══════════════════════════════════════════════════════════════════════════
-- §3 · EL ÍNDICE QUE LE FALTA A `event_logs`
-- ═══════════════════════════════════════════════════════════════════════════
-- Medido: `event_logs` tiene UN SOLO índice, la clave primaria. La campana la
-- consulta por `(tenant_id, status, acknowledged_at)` en cada carga y en cada
-- reconexión de cada operador. Con tres filas da lo mismo; con un año de
-- alertas, no.
--
-- ⚠️ Parcial sobre las pendientes: ocupa lo que ocupan las que están abiertas
-- sin atender, no el histórico entero. Es el mismo criterio que
-- `idx_trip_conditions_sla`, que ya existía para la otra fuente.
create index if not exists idx_event_logs_pendientes
  on event_logs (tenant_id, triggered_at desc)
  where status = 'open' and acknowledged_at is null;


-- ═══════════════════════════════════════════════════════════════════════════
-- §4 · VERIFICACIÓN — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- 4.a · ⚠️ EL CONTROL QUE IMPORTA: qué interrumpe y qué no.
select '§4.a · quién corta la pantalla' as bloque,
       codigo, orden, color,
       requiere_atencion_operador as entra_a_la_campana,
       interrumpe_al_operador     as corta_la_pantalla,
       severidad_evento,
       case
         when codigo in ('riesgo_critico', 'activacion_policial') and interrumpe_al_operador
           then 'OK · interrumpe'
         when codigo in ('panorama_normal', 'anomalia') and not interrumpe_al_operador
           then 'OK · no interrumpe'
         else '⚠️ NO COINCIDE con lo que propuso el §2'
       end as resultado
from motor_niveles_riesgo
order by orden;

-- 4.b · Las cuatro condiciones que el motor abre hoy, y qué va a hacer cada una.
-- ESPERADO: SIN_REPORTE y DESVIO_DE_RUTA con aviso rojo; las dos paradas no.
select '§4.b · qué va a hacer cada condición del motor' as bloque,
       mt.codigo, mt.riesgo_default,
       case when nr.interrumpe_al_operador
            then 'AVISO ROJO + sonido que se repite'
            else 'entra a la campana, sonido corto' end as comportamiento
from motor_tipos_condicion mt
join motor_niveles_riesgo nr on nr.codigo = mt.riesgo_default and nr.tenant_id is null
where mt.codigo in ('SIN_REPORTE', 'DESVIO_DE_RUTA', 'PARADA_NO_AUTORIZADA', 'PARADA_PROLONGADA')
order by nr.orden desc, mt.codigo;

-- 4.c · Ninguna severidad de `event_logs` puede quedar huérfana EN SILENCIO.
-- Si alguna aparece sin nivel, la campana la muestra «sin clasificar» y sin
-- interrumpir — que es el fallo seguro, no un olvido. Pero conviene saberlo.
select '§4.c · severidades sin traducir' as bloque,
       e.severity,
       count(*) as alertas,
       case when nr.codigo is null
            then '⚠️ sin traducir: entra sin clasificar y NO interrumpe'
            else 'OK · ' || nr.codigo end as resultado
from event_logs e
left join motor_niveles_riesgo nr on nr.severidad_evento = e.severity
group by e.severity, nr.codigo
order by e.severity;

-- 4.d · El índice nuevo, POR DEFINICIÓN y no por nombre.
-- ⚠️ `create index if not exists` mira el NOMBRE: si ya hubiera uno con ese
-- nombre y otra definición, lo saltearía en silencio. Es la lección de la 3B,
-- donde `idx_trip_conditions_abiertas` ya existía con otra forma.
select '§4.d · el índice nuevo' as bloque,
       v.esperado as indice,
       coalesce(i.indexdef, '(no existe)') as definicion_real,
       case
         when i.indexname is null then '⛔ NO SE CREÓ'
         when i.indexdef like '%(tenant_id, triggered_at DESC)%'
          and i.indexdef like '%status%' then 'OK · columnas y WHERE parcial'
         else '⛔ HAY UNO CON ESE NOMBRE PERO CON OTRA DEFINICIÓN'
       end as resultado
from (values ('idx_event_logs_pendientes')) as v(esperado)
left join pg_indexes i on i.tablename = 'event_logs' and i.indexname = v.esperado;

-- 4.e · Las dos columnas nuevas existen y con el tipo que el código espera.
select '§4.e · las columnas nuevas' as bloque,
       column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'motor_niveles_riesgo'
  and column_name in ('interrumpe_al_operador', 'severidad_evento')
order by column_name;
