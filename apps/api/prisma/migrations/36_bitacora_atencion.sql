-- ═══════════════════════════════════════════════════════════════════════════
-- ETAPA 3C-A · LA BITÁCORA DE ATENCIÓN
-- Base: rudaqsfgjorryuqayqyd (PostgreSQL 17.6)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ NO EJECUTADO POR EL AGENTE. Lo ejecuta Gustavo.
-- ⚠️ Sin metacomandos de psql y SIN bloques `DO $$` — el editor de Supabase
--    los rompe. Regla que salió de aplicar la 3A.
-- ⚠️ CORRER ESTE SCRIPT **ANTES** DE DESPLEGAR EL CÓDIGO. La bitácora lee
--    tablas y columnas que hoy no existen.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️ POR QUÉ NO SE USA `operational_protocols` — la pregunta que hiciste
-- ══════════════════════════════════════════════════════════════════════════
--
-- La medí antes de decidir. Tiene 10 filas (no 6), todas globales, y todas
-- con los MISMOS dos pasos genéricos: «Verificar estado del vehículo» y
-- «Contactar al conductor». Tenías razón en que es un molde vacío.
--
-- Pero el problema no es que esté vacía: es que **contesta otra pregunta**.
-- Su clave es una matriz de cuatro dimensiones del estado operativo —
-- `trip_status` × `sub_status` × `gps_reporting` × `driver_communication` —
-- y lo que devuelve es un `risk_level` y un SLA. O sea: sirve para DEDUCIR LA
-- GRAVEDAD a partir del estado, que es el motor de protocolos de la Etapa 6.
--
-- Lo que hace falta acá es otra cosa: **qué pasos recorre un operador cuando
-- atiende una alerta de tipo X**. La clave natural de eso es el TIPO DE
-- CONDICIÓN, que en esa tabla no existe. Y no se puede agregar sin romperla:
-- su unicidad es esa cuádrupla, así que una fila por tipo de condición
-- obligaría a dejar en null cuatro columnas `not null` o a inventar valores
-- que no significan nada.
--
-- ⚠️ Y hay una trampa que conviene nombrar: `sub_status` tiene valores que se
-- PARECEN a los tipos de condición —`desvio_ruta`, `perdida_senal`,
-- `boton_panico`— pero no son los mismos códigos: el catálogo del motor usa
-- `DESVIO_DE_RUTA`, `SIN_REPORTE`, `SOS`. Atar las dos cosas por parecido
-- habría sido inventar una correspondencia y llamarla medición.
--
-- Así que la doctrina de atención va en tablas propias, con el tipo de
-- condición como clave, y `operational_protocols` queda como está.
--
-- ── QUÉ HACE ──────────────────────────────────────────────────────────────
--   §0  PRE-VUELO (solo lectura)
--   §1  la jerarquía de roles, que hoy NO EXISTE
--   §2  el catálogo de pasos, por tipo de condición
--   §3  el catálogo de resultados, por tipo de condición
--   §4  la bitácora: el hilo de entradas
--   §5  el permiso nuevo
--   §6  LA DOCTRINA — los pasos y resultados aprobados
--   §7  VERIFICACIÓN (solo lectura)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §0 · PRE-VUELO — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ LOS ROLES, TAL COMO ESTÁN. Ocho, y NINGUNA columna de jerarquía: la
-- tabla es (id, code, name, is_system_role, permissions). Sin esto, «escalar
-- al de mayor rango» no tiene destinatario.
select '§0.a · roles, hoy' as bloque,
       code, name, is_system_role, array_length(permissions, 1) as cuantos_permisos
from roles
order by code;

-- ⚠️ Y POR QUÉ NO SE PUEDE DEDUCIR LA JERARQUÍA DE LOS PERMISOS. Mirá
-- `gerencia`: 8 permisos, menos que `operator` (12). Por cantidad de permisos,
-- un gerente estaría por debajo de un operador de monitoreo. Contar permisos
-- es una medida de lo que alguien puede tocar, no de quién manda.
select '§0.b · por qué contar permisos no sirve' as bloque,
       code, array_length(permissions, 1) as permisos,
       case when code = 'gerencia' then '⚠️ menos permisos que operator, y es superior'
            else '' end as nota
from roles
order by array_length(permissions, 1) desc;

-- Los protocolos que ya existen, con sus pasos. ESPERADO: 10 filas, todas con
-- los mismos dos pasos genéricos. Es el molde vacío.
select '§0.c · operational_protocols' as bloque,
       name, risk_level, sub_status, sla_minutes,
       jsonb_array_length(protocol_steps) as cuantos_pasos,
       protocol_steps::text as pasos
from operational_protocols
order by risk_level, name;

-- ⚠️ ¿Existe algún catálogo de resultados de atención? ESPERADO: ninguna fila.
-- Lo busqué por nombre de tabla y lo único que hay es `operational_protocols`.
select '§0.d · catálogos de atención que ya existan' as bloque, table_name
from information_schema.tables
where table_schema = 'public'
  and (table_name like '%resultado%' or table_name like '%bitacora%'
       or table_name like '%atencion%' or table_name like '%escalad%')
order by table_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- §1 · LA JERARQUÍA DE ROLES
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ SON TRES COLUMNAS, porque son TRES preguntas distintas. Empecé con dos y
-- la medición del caso real agregó la tercera:
--
--   `nivel_jerarquico`     → ¿QUIÉN MANDA? Es el organigrama. Necesita orden.
--   `puede_cerrar_alertas` → ¿Quién tiene la FACULTAD de cerrar sin recorrer
--                            el protocolo? Es una política.
--   `recibe_escaladas`     → ¿QUIÉN ESTÁ MIRANDO EL PANEL? Es un hecho
--                            operativo, y NO se deduce de los otros dos.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️ POR QUÉ `nivel_jerarquico` SOLO NO ALCANZABA — el caso real
-- ══════════════════════════════════════════════════════════════════════════
--
-- En esta organización el jefe de flota (`manager`) tiene más permisos que
-- `gerencia` porque usa el sistema todos los días; el gerente está más arriba
-- en el organigrama y casi no entra al panel. **Escalarle a él a las tres de
-- la mañana es perder la alerta.**
--
-- Es el mismo razonamiento por el que `rusertech_admin` quedó en 0 —estar alto
-- no es estar mirando— sólo que ahí alcanzaba con el nivel y acá no:
-- `gerencia` SÍ manda más que `manager`, y el organigrama tiene que poder
-- decirlo sin que eso desvíe una alerta a un teléfono apagado.
--
-- Con la tercera columna las dos cosas quedan dichas como son: el organigrama
-- ordena, y la escalada busca **al de mayor nivel ENTRE LOS QUE RECIBEN**.

alter table roles
  add column if not exists nivel_jerarquico smallint not null default 0;

alter table roles
  add column if not exists puede_cerrar_alertas boolean not null default false;

alter table roles
  add column if not exists recibe_escaladas boolean not null default false;

comment on column roles.nivel_jerarquico is
  'Orden de mando, mayor es mas alto. Lo usa la escalada para encontrar al usuario de mayor rango del cliente. No se deduce de la cantidad de permisos: gerencia tiene menos permisos que operator y esta por encima.';

comment on column roles.puede_cerrar_alertas is
  'Si es true, este rol puede CERRAR una alerta sin recorrer el protocolo, dejando el motivo escrito. Es una facultad, distinta del nivel jerarquico: un rol podria estar alto y no tenerla.';

comment on column roles.recibe_escaladas is
  'Si es true, este rol puede ser DESTINO de una escalada: gente que mira el panel. Distinta del nivel jerarquico: gerencia manda mas que manager y no recibe, porque no entra al sistema. Escalarle a alguien que no mira es perder la alerta.';

-- ⚠️ LOS VALORES SON UNA PROPUESTA Y SE CAMBIAN CON UN UPDATE.
--
-- Las dos filas que explican por qué hacían falta tres columnas:
--
--   `gerencia`        70, CIERRA, y **NO recibe**. Manda más que el jefe de
--                     flota y casi no entra al panel. El organigrama queda
--                     dicho como es, y la alerta va a quien la va a atender.
--   `rusertech_admin` 0, CIERRA, y **NO recibe**. Personal de la plataforma,
--                     no de la cadena de mando del cliente.
--
-- Las dos dicen lo mismo con distinto motivo: **estar arriba no es estar
-- mirando**, y una escalada necesita a alguien que esté mirando.
update roles set nivel_jerarquico = 90, puede_cerrar_alertas = true,  recibe_escaladas = true  where code = 'account_owner';
update roles set nivel_jerarquico = 70, puede_cerrar_alertas = true,  recibe_escaladas = false where code = 'gerencia';
update roles set nivel_jerarquico = 60, puede_cerrar_alertas = true,  recibe_escaladas = true  where code = 'manager';
update roles set nivel_jerarquico = 50, puede_cerrar_alertas = false, recibe_escaladas = false where code = 'key_user';
update roles set nivel_jerarquico = 30, puede_cerrar_alertas = false, recibe_escaladas = false where code = 'operator';
update roles set nivel_jerarquico = 10, puede_cerrar_alertas = false, recibe_escaladas = false where code = 'viewer';
update roles set nivel_jerarquico =  0, puede_cerrar_alertas = false, recibe_escaladas = false where code = 'driver';
update roles set nivel_jerarquico =  0, puede_cerrar_alertas = true,  recibe_escaladas = false where code = 'rusertech_admin';

-- ⚠️ CON ESTOS VALORES, EL DESTINO DE TODA ESCALADA ES `manager` O
-- `account_owner` — los dos únicos que reciben. Si mañana querés que un
-- `key_user` también reciba, es un UPDATE y la próxima escalada lo respeta.
--
-- ⚠️ Y SI NADIE RECIBE, el servicio lo dice con todas las letras —«No hay a
-- quién escalar»— en vez de escalar al vacío. El §7.b lo muestra antes.

-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️ DÓNDE SE CONFIGURA CADA COSA — medido, y son dos lugares distintos
-- ══════════════════════════════════════════════════════════════════════════
--
-- LAS TRES COLUMNAS DE ARRIBA van en **Administración global → Roles**, NO en
-- la configuración del cliente. La razón está en el esquema: `roles` **no
-- tiene `tenant_id`** y sus ocho filas son `is_system_role = true`. Son
-- compartidas por todos los clientes, así que un cliente editando su
-- organigrama se lo pisaría a todos. Ya existen GET/POST/PUT /admin/roles.
--
-- EL PERMISO `manage_critical_alerts` va por USUARIO, en **Configuración →
-- Gestión de Usuarios**, con `users.granted_permissions` y
-- `users.revoked_permissions`, que ya existen. No hace falta un rol nuevo.
--
-- ⚠️ Y HAY UNA VENTANA QUE CONVIENE CONOCER, medida y explicada en el reporte:
-- el permiso por usuario SÍ se respeta, pero `PermissionsGuard` lo lee del
-- TOKEN, que se arma al iniciar sesión. Entre que un supervisor lo otorga y
-- que el operador vuelve a entrar, la PANTALLA ya lo ve —el frontend relee
-- `/auth/me`— y la API todavía no. Para la atención de alertas críticas esa
-- ventana quedó cerrada en esta corrección: la comprobación lee la base.


-- ═══════════════════════════════════════════════════════════════════════════
-- §2 · LOS PASOS, POR TIPO DE CONDICIÓN
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ `tenant_id` NULLABLE, igual que `motor_niveles_riesgo`: null es la
-- doctrina global y una fila con cliente la reemplaza. Es el patrón de
-- catálogo híbrido que ya usa el proyecto; no se inventa uno nuevo.
create table if not exists motor_pasos_protocolo (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid references tenants(id) on delete cascade,
  tipo_condicion varchar(60) not null references motor_tipos_condicion(codigo),
  orden          smallint not null,
  accion         varchar(200) not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table motor_pasos_protocolo is
  'Los pasos que un operador recorre al atender una alerta de cada tipo. Doctrina, no codigo: se edita con UPDATE. tenant_id null es la version global.';

-- Dos índices parciales en vez de uno con coalesce: es la forma que ya usa
-- `uq_motor_niveles_riesgo_global` y no necesita un uuid centinela.
create unique index if not exists uq_pasos_protocolo_global
  on motor_pasos_protocolo (tipo_condicion, orden) where tenant_id is null;
create unique index if not exists uq_pasos_protocolo_cliente
  on motor_pasos_protocolo (tenant_id, tipo_condicion, orden) where tenant_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3 · LOS RESULTADOS, POR TIPO DE CONDICIÓN
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists motor_resultados_atencion (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references tenants(id) on delete cascade,
  tipo_condicion    varchar(60) not null references motor_tipos_condicion(codigo),
  codigo            varchar(60) not null,
  nombre            varchar(120) not null,
  orden             smallint not null,
  -- ⚠️ ESTA COLUMNA ES LA QUE HACE QUE «No responde» HABILITE ESCALAR, y está
  -- en la base y no en el código a propósito. Si mañana se decide que «Falla
  -- del GPS» también habilita escalar, es un UPDATE.
  habilita_escalada boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

comment on table motor_resultados_atencion is
  'Opciones preestablecidas de resultado al atender, por tipo de condicion. habilita_escalada marca cuales dejan escalar (hoy: No responde, en todas).';

create unique index if not exists uq_resultados_atencion_global
  on motor_resultados_atencion (tipo_condicion, codigo) where tenant_id is null;
create unique index if not exists uq_resultados_atencion_cliente
  on motor_resultados_atencion (tenant_id, tipo_condicion, codigo) where tenant_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- §4 · LA BITÁCORA — el hilo
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ ES UN HILO DE ENTRADAS, NO UN CAMPO. Varias por alerta, hasta el cierre.
-- La llamada que no atendieron vale tanto como la que sí: si el cliente
-- pregunta por qué nadie hizo nada durante 40 minutos, la respuesta son estas
-- filas.
create table if not exists trip_condition_bitacora (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  -- ⚠️ POLIMÓRFICA POR `fuente`, y por eso NO hay clave foránea a la alerta:
  -- son dos padres posibles —`trip_conditions` y `event_logs`— y una FK sólo
  -- puede apuntar a uno. La integridad la sostiene la aplicación, que nunca
  -- escribe una entrada sin haber leído antes la alerta acotada por cliente.
  fuente           varchar(20) not null,
  alerta_id        uuid not null,
  usuario_id       uuid not null references users(id),
  accion           varchar(20) not null,
  paso_id          uuid references motor_pasos_protocolo(id),
  resultado_codigo varchar(60),
  nota             text,
  escalado_a       uuid references users(id),
  created_at       timestamptz not null default now()
);

alter table trip_condition_bitacora drop constraint if exists chk_bitacora_fuente;
alter table trip_condition_bitacora add constraint chk_bitacora_fuente
  check (fuente in ('condicion', 'evento'));

alter table trip_condition_bitacora drop constraint if exists chk_bitacora_accion;
alter table trip_condition_bitacora add constraint chk_bitacora_accion
  check (accion in ('registro', 'escalada', 'cierre'));

-- ⚠️ ESTE CHECK ES LA REGLA «REGISTRAR ES OBLIGATORIO», EN LA BASE.
--
-- No se puede silenciar una alerta sin decir qué se hizo. Vale un resultado
-- del catálogo O texto libre, pero alguno hay que elegir. Está acá además de
-- en el servicio porque una regla de negocio que sólo vive en el código se
-- puede saltear con un INSERT a mano, y esta tabla es la prueba que el
-- producto le muestra al cliente.
alter table trip_condition_bitacora drop constraint if exists chk_bitacora_dice_algo;
alter table trip_condition_bitacora add constraint chk_bitacora_dice_algo
  check (
    resultado_codigo is not null
    or (nota is not null and length(btrim(nota)) > 0)
  );

-- Una escalada tiene que decir a quién; un cierre tiene que decir por qué.
alter table trip_condition_bitacora drop constraint if exists chk_bitacora_escalada_tiene_destino;
alter table trip_condition_bitacora add constraint chk_bitacora_escalada_tiene_destino
  check (accion <> 'escalada' or escalado_a is not null);

alter table trip_condition_bitacora drop constraint if exists chk_bitacora_cierre_tiene_motivo;
alter table trip_condition_bitacora add constraint chk_bitacora_cierre_tiene_motivo
  check (accion <> 'cierre' or (nota is not null and length(btrim(nota)) > 0));

comment on table trip_condition_bitacora is
  'Hilo de entradas de atencion sobre una alerta. Polimorfica por fuente: alerta_id apunta a trip_conditions o event_logs. Varias entradas por alerta, hasta el cierre.';

-- El hilo se lee siempre por alerta y en orden. Acotado por cliente porque
-- toda consulta de este producto lo está.
create index if not exists idx_bitacora_alerta
  on trip_condition_bitacora (tenant_id, fuente, alerta_id, created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- §5 · EL PERMISO NUEVO
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ El formato del catálogo es `accion_recurso` —`manage_alerts`,
-- `view_trips`— y este lo respeta: `manage_critical_alerts`. Medido en
-- `common/constants/permissions.ts`, que es la fuente de verdad y tiene su
-- espejo en el frontend. Los dos se actualizan en el código de esta entrega.
--
-- Un operador SIN este permiso ve la alerta roja y el botón deshabilitado con
-- el motivo. Nunca escondido.
update roles
   set permissions = array_append(permissions, 'manage_critical_alerts')
 where code in ('rusertech_admin', 'account_owner', 'manager')
   and not (permissions @> array['manage_critical_alerts']);

-- ⚠️ `operator` NO lo recibe de entrada, y es el punto del permiso: se otorga
-- operador por operador desde la pantalla de usuarios. Si querés dárselo a
-- todos los operadores de una, es este mismo UPDATE con 'operator'.


-- ═══════════════════════════════════════════════════════════════════════════
-- §6 · LA DOCTRINA
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ VA ACÁ Y NO EN EL CÓDIGO. El cliente la ajusta sin desplegar.
--
-- Se carga como doctrina GLOBAL (`tenant_id` null). Un cliente que quiera la
-- suya inserta filas con su `tenant_id` y el servicio las prefiere.
--
-- ⚠️ Los `insert … select … where not exists` son la forma idempotente sin
-- bloques `DO`: correr el script dos veces deja lo mismo.

-- ── 6.1 · LOS PASOS ───────────────────────────────────────────────────────
insert into motor_pasos_protocolo (tenant_id, tipo_condicion, orden, accion)
select null, d.tipo, d.orden, d.accion
from (values
  ('SOS',                  1::smallint, 'Llamar al conductor'),
  ('SOS',                  2::smallint, 'Verificar posición'),
  ('SOS',                  3::smallint, 'Avisar al cliente'),
  ('SIN_REPORTE',          1::smallint, 'Llamar al conductor'),
  ('SIN_REPORTE',          2::smallint, 'Revisar zona sin cobertura'),
  ('DESVIO_DE_RUTA',       1::smallint, 'Llamar al conductor'),
  ('DESVIO_DE_RUTA',       2::smallint, 'Confirmar motivo'),
  ('PARADA_PROLONGADA',    1::smallint, 'Llamar al conductor'),
  ('PARADA_NO_AUTORIZADA', 1::smallint, 'Llamar al conductor')
) as d(tipo, orden, accion)
join motor_tipos_condicion mt on mt.codigo = d.tipo
where not exists (
  select 1 from motor_pasos_protocolo p
  where p.tenant_id is null and p.tipo_condicion = d.tipo and p.orden = d.orden
);

-- ── 6.2 · LOS RESULTADOS ──────────────────────────────────────────────────
-- ⚠️ `NO_RESPONDE` aparece en las cinco con `habilita_escalada = true`. Es el
-- resultado que deja escalar, y está marcado en la fila y no en un `if`.
insert into motor_resultados_atencion
  (tenant_id, tipo_condicion, codigo, nombre, orden, habilita_escalada)
select null, d.tipo, d.codigo, d.nombre, d.orden, d.escala
from (values
  -- SOS / Pánico
  ('SOS', 'FALSA_ALARMA',        'Falsa alarma',         1::smallint, false),
  ('SOS', 'NO_RESPONDE',         'No responde',          2::smallint, true),
  ('SOS', 'ACTIVACION_POLICIAL', 'Activación policial',  3::smallint, false),
  ('SOS', 'ROBO_CONFIRMADO',     'Robo confirmado',      4::smallint, false),
  -- Sin reporte
  ('SIN_REPORTE', 'ZONA_SIN_SENAL',    'Zona sin señal',      1::smallint, false),
  ('SIN_REPORTE', 'FALLA_GPS',         'Falla del GPS',       2::smallint, false),
  ('SIN_REPORTE', 'NO_RESPONDE',       'No responde',         3::smallint, true),
  ('SIN_REPORTE', 'VOLVIO_A_REPORTAR', 'Volvió a reportar',   4::smallint, false),
  -- Desvío de ruta
  ('DESVIO_DE_RUTA', 'DESVIO_AUTORIZADO', 'Desvío autorizado',       1::smallint, false),
  ('DESVIO_DE_RUTA', 'CORTE_DE_RUTA',     'Corte de ruta',           2::smallint, false),
  ('DESVIO_DE_RUTA', 'ERROR_DE_CARGA',    'Error de carga de ruta',  3::smallint, false),
  ('DESVIO_DE_RUTA', 'NO_RESPONDE',       'No responde',             4::smallint, true),
  -- Parada prolongada
  ('PARADA_PROLONGADA', 'DESCANSO',         'Descanso',          1::smallint, false),
  ('PARADA_PROLONGADA', 'CARGA_DESCARGA',   'Carga/descarga',    2::smallint, false),
  ('PARADA_PROLONGADA', 'DESPERFECTO',      'Desperfecto',       3::smallint, false),
  ('PARADA_PROLONGADA', 'CONTROL_POLICIAL', 'Control policial',  4::smallint, false),
  ('PARADA_PROLONGADA', 'NO_RESPONDE',      'No responde',       5::smallint, true),
  -- Parada no autorizada
  ('PARADA_NO_AUTORIZADA', 'PARADA_JUSTIFICADA', 'Parada justificada',      1::smallint, false),
  ('PARADA_NO_AUTORIZADA', 'UBICACION_MAL_CARGADA', 'Ubicación mal cargada', 2::smallint, false),
  ('PARADA_NO_AUTORIZADA', 'NO_RESPONDE',        'No responde',             3::smallint, true)
) as d(tipo, codigo, nombre, orden, escala)
join motor_tipos_condicion mt on mt.codigo = d.tipo
where not exists (
  select 1 from motor_resultados_atencion r
  where r.tenant_id is null and r.tipo_condicion = d.tipo and r.codigo = d.codigo
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §7 · VERIFICACIÓN — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- 7.a · La jerarquía quedó cargada, y `rusertech_admin` NO es destino.
select '§7.a · las tres preguntas' as bloque,
       code, name,
       nivel_jerarquico      as quien_manda,
       puede_cerrar_alertas  as puede_cerrar,
       recibe_escaladas      as esta_mirando,
       case
         when code = 'gerencia' and nivel_jerarquico = 70 and not recibe_escaladas
           then 'OK · manda más que manager y NO recibe: es el caso que pidió la tercera columna'
         when code = 'rusertech_admin' and not recibe_escaladas
           then 'OK · personal de plataforma, nunca destino'
         when recibe_escaladas then 'OK · puede recibir escaladas'
         else 'no recibe escaladas'
       end as resultado
from roles
order by nivel_jerarquico desc, code;

-- 7.b · ⚠️ A QUIÉN SE ESCALA, por cliente. ES LA MISMA CONSULTA QUE USA EL
-- SERVICIO, y por eso filtra por `recibe_escaladas`.
--
-- ⚠️ Si no filtrara por la columna nueva mostraría un destino DISTINTO del que
-- la escalada elige de verdad — y eso es peor que no mostrarlo: este bloque
-- diría «se escala al gerente» y el sistema se lo mandaría al jefe de flota.
-- Una verificación que no comprueba lo mismo que hace el código es una
-- verificación que miente.
select '§7.b · destino de escalada por cliente' as bloque,
       t.name as cliente, u.email, u.role_code,
       r.nivel_jerarquico, r.recibe_escaladas
from tenants t
join users u on u.tenant_id = t.id
join roles r on r.code = u.role_code
where r.recibe_escaladas
  and u.status = 'active'
  and r.nivel_jerarquico = (
    select max(r2.nivel_jerarquico)
    from users u2 join roles r2 on r2.code = u2.role_code
    where u2.tenant_id = t.id and u2.status = 'active' and r2.recibe_escaladas
  )
order by t.name, u.created_at;

-- 7.b-bis · ⚠️ LOS QUE MANDAN PERO NO MIRAN. Hace visible la decisión: si acá
-- aparece alguien que SÍ debería recibir la escalada, es un UPDATE. Y si el
-- §7.b vino vacío, acá se ve por qué.
select '§7.b-bis · alto rango que NO recibe escaladas' as bloque,
       u.email, u.role_code, r.nivel_jerarquico,
       'no entra al panel: escalarle sería perder la alerta' as motivo
from users u
join roles r on r.code = u.role_code
where r.nivel_jerarquico > 0 and not r.recibe_escaladas and u.status = 'active'
order by r.nivel_jerarquico desc, u.email;

-- 7.c · La doctrina. ESPERADO: 9 pasos y 20 resultados, los 5 tipos.
select '§7.c · la doctrina cargada' as bloque,
       p.tipo_condicion,
       count(distinct p.id) as pasos,
       (select count(*) from motor_resultados_atencion r
         where r.tipo_condicion = p.tipo_condicion and r.tenant_id is null) as resultados,
       (select count(*) from motor_resultados_atencion r
         where r.tipo_condicion = p.tipo_condicion and r.tenant_id is null
           and r.habilita_escalada) as habilitan_escalada
from motor_pasos_protocolo p
where p.tenant_id is null
group by p.tipo_condicion
order by p.tipo_condicion;

-- 7.d · ⚠️ «No responde» en TODAS. Si alguna da 0, esa alerta no se puede
-- escalar y el operador se queda sin salida.
select '§7.d · todas pueden escalar' as bloque,
       mt.codigo,
       count(r.id) filter (where r.habilita_escalada) as resultados_que_escalan,
       case when count(r.id) filter (where r.habilita_escalada) > 0
            then 'OK' else '⛔ esta alerta no tiene cómo escalarse' end as resultado
from motor_tipos_condicion mt
left join motor_resultados_atencion r
       on r.tipo_condicion = mt.codigo and r.tenant_id is null
where mt.codigo in ('SOS','SIN_REPORTE','DESVIO_DE_RUTA','PARADA_PROLONGADA','PARADA_NO_AUTORIZADA')
group by mt.codigo
order by mt.codigo;

-- 7.e · El CHECK que hace obligatorio registrar. Es la regla, en la base.
select '§7.e · los CHECK de la bitácora' as bloque,
       conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'trip_condition_bitacora'::regclass and contype = 'c'
order by conname;

-- 7.f · ⚠️ EL PERMISO NUEVO SE MIRA POR USUARIO, NO POR ROL.
--
-- `manage_critical_alerts` no se agrega a ningún rol: se otorga persona por
-- persona desde Configuración → Gestión de Usuarios, que escribe en
-- `users.granted_permissions`. Una consulta sobre `roles.permissions` diría
-- «nadie lo tiene» para siempre, aunque el supervisor ya se lo haya dado a
-- tres operadores.
--
-- Esta es la MISMA cuenta que hace `permisosVigentesDe` en el servicio:
-- (permisos del rol ∪ granted) − revoked.
--
-- ⚠️ LO QUE MEDÍ ANTES DE ESCRIBIR ESTO: hoy da `false` para los ocho
-- usuarios de tu base, incluido `owner@rusertech.com`. Es correcto —el
-- permiso es nuevo y nadie lo tiene— pero significa que, apenas apliques
-- esto, el botón «Atender» de una alerta CRÍTICA va a aparecer
-- DESHABILITADO CON EL MOTIVO para todos menos `admin@rusertech.com`, que
-- pasa por ser administrador del sistema y no por el permiso. Si no lo sabés
-- de antemano parece que la etapa no anda.
select '§7.f · manage_critical_alerts, por usuario' as bloque,
       u.email, u.role_code, u.status,
       (select coalesce(bool_or(p in ('manage_critical_alerts','*')), false)
          from unnest(coalesce(r.permissions,'{}') || coalesce(u.granted_permissions,'{}')) as p
         where not (coalesce(u.revoked_permissions,'{}') @> array[p])) as atiende_criticas,
       case when u.role_code = 'rusertech_admin'
            then 'pasa igual: es administrador del sistema'
            else 'se otorga en Configuración → Gestión de Usuarios' end as nota
from users u
join roles r on r.code = u.role_code
order by r.nivel_jerarquico desc, u.email;
