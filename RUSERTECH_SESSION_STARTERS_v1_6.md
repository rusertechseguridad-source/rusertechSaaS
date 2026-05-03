# 🛰️ RUSERTECH — MENSAJES DE INICIO DE SESIÓN v1.6
## Un mensaje por bloque — copiar y pegar al inicio de cada sesión del IDE

> **Instrucción de uso:**
> 1. El Master Prompt **v4.0** debe estar cargado en el IDE antes de pegar cualquier mensaje.
>    No cargar v3.9 en paralelo — v4.0 lo reemplaza completamente.
> 2. Copiar el mensaje del bloque correspondiente.
> 3. Pegarlo como primer mensaje de la sesión.
> 4. Luego copiar el bloque completo del Master Prompt (sección 🔨 BLOQUE X).
> 5. No avanzar al siguiente bloque hasta que el checklist esté 100% verde.
>
> **Cambios vs v1.5:**
> - Referencias actualizadas de v3.9 a v4.0
> - BLOQUE -1 agregado: Sitio Público / Landing Page (React solo, sin NestJS)
> - Regla 46 incorporada en el starter del BLOQUE -1
> - Orden de bloques: -1 → 0 → 1 → ... → 9

---

## 📋 BLOQUE -1 — Sitio Público (Landing Page)

```
Hola. Vamos a construir el sitio público de Rusertech (rusertech.com).

El Master Prompt v4.0 está cargado en tu contexto.

ANTES DE ESCRIBIR CÓDIGO, leé estas secciones del Master Prompt:
1. PARTE 0 — SITIO PÚBLICO Y MARKETING (sección completa del BLOQUE -1).
2. Regla 46: separación de responsabilidades Sitio Público vs SaaS.
3. Regla 5: tokens de diseño — ningún color, fuente o sombra hardcodeada.
4. Regla 10: logo Rusertech visible en Header y Footer.
5. Design System completo (colores, tipografía, sombras).

CONTEXTO TÉCNICO IMPORTANTE:
- Este bloque es 100% React frontend. NO modifica NestJS.
- NO instanciar Socket.io, Zustand del SaaS ni lógica de telemetría.
- Trabajar en apps/web/src/ — sobre el proyecto React existente.
- Si el usuario ya tiene sesión activa → redirect a /map (Regla 46b).

ESTADO ACTUAL:
- Es el primer bloque a construir. No hay infraestructura de backend aún.
- La app React existe (creada en el Bloque 0 de setup previo) o se puede
  inicializar ahora solo para el sitio público.

OBJETIVO DE ESTA SESIÓN:
PublicLayout con Header (logo + nav + CTA "Iniciar Sesión") y Footer.
4 páginas: / (Home con Hero + 3 cards + CTA final), /nosotros (texto B2B),
/servicios (6 módulos), /contacto (formulario con estado de éxito local).
Redirección automática /→/map si hay sesión activa.
Todo con tokens del Design System — cero valores hardcodeados.

ATENCIÓN ESPECIAL — TIPOGRAFÍAS (Regla 5 aplicada):
  Títulos: Exo 2, font-weight 800 (extrabold)
  Body: DM Sans, font-weight 400/500/600
  NUNCA usar Inter, Roboto, Arial ni fuentes del sistema.
  Importar desde Google Fonts en index.html si no están ya cargadas.

ATENCIÓN ESPECIAL — COLORES OBLIGATORIOS:
  Fondo secciones: linear-gradient(180deg, #1F2A5A 0%, #2B2F6E 100%)
  Cards: background #252D6B, border rgba(124,255,60,0.15)
  Botones CTA: gradiente accent (linear-gradient(135deg, #7CFF3C, #33E1A1, #2AB3FF))
  Texto sobre CTA: #1F2A5A (textOnAccent)
  Inputs formulario: background #2E3578 (bgSurfaceHigh)

Lee el BLOQUE -1 completo del Master Prompt antes de escribir cualquier código.
```

---

## 📋 BLOQUE 0 — Infraestructura y Credenciales

```
Hola. Vamos a construir el proyecto Rusertech.

El Master Prompt v4.0 está cargado en tu contexto. Antes de escribir
cualquier línea de código, necesito que:

1. Leas las REGLAS DE ORO (numeradas del 1 al 45) del Master Prompt.
   Estas reglas nunca se rompen. Si en algún momento una decisión técnica
   choca con una Regla de Oro, la Regla de Oro gana siempre.
   Presta especial atención a las Reglas 33-45:
   - Regla 33: CSS del contenedor del mapa (posición + flex + overflow)
   - Regla 34: Persistencia de layout en localStorage por usuario
   - Regla 35: FilterDrawer como único punto de entrada de filtros
   - Regla 36: Carga de Viaje sin señal requerida del HUB
   - Regla 37: Paleta de riesgo — 4 colores únicos diferenciados
   - Regla 38: Tooltips como estándar de UX en todo el sistema
   - Regla 39: Bloqueo de vehículo con email automático a AVL y cliente
   - Regla 40: Geocercas 1:N recorridos — asignación libre por recorrido
   - Regla 41: Fechas de viaje opcionales (inicio y fin no obligatorios)
   - Regla 42: Analytics — período por defecto mes calendario actual
   - Regla 43: Trip ID visible en pantalla de confirmación al crear viaje
   - Regla 44: Filtros de recorrido por cliente y tipo en CreateTripFlow
   - Regla 45: USE_TIMESCALEDB — toggle de entorno, default=false
     PostgreSQL nativo por defecto (compatible Supabase Free).
     TimescaleDB activable con USE_TIMESCALEDB=true cuando se migre a Pro.

2. Leas el DESIGN SYSTEM completo (colores, tipografía, espaciado).
   Ningún valor de color, tamaño o fuente puede estar hardcodeado en la UI.
   Todo usa los tokens definidos ahí. Incluye los tokens de riesgo:
   riskNormal, riskElevado, riskAlto, riskCritico (Regla 37).

3. Leas la sección BLOQUE 0 del Master Prompt completa antes de generar
   cualquier archivo.

ESTADO ACTUAL DEL PROYECTO:
- Es una sesión nueva. No hay nada construido todavía.
- Este es el primer bloque. El prerequisito es ninguno.

OBJETIVO DE ESTA SESIÓN:
Repositorio base funcional con monorepo NestJS + React, conexiones a
Supabase y Upstash Redis verificadas, migraciones corriendo, seed de
datos cargado, y ambas apps levantando en localhost.

ATENCIÓN ESPECIAL — Regla 45 (telemetría):
La tabla telemetry NO usa prisma migrate dev. Tiene dos archivos SQL
de migración separados según el modo elegido:
  - USE_TIMESCALEDB=false (default): ejecutar 001_telemetry_partitioned.sql
    + 002_telemetry_partition_cron.sql (pg_cron para particiones futuras)
  - USE_TIMESCALEDB=true: ejecutar 001_telemetry_hypertable.sql
Agregar USE_TIMESCALEDB=false en apps/api/.env antes de ejecutar.

Cuando termines de leer las tres secciones indicadas, pedime las
credenciales en el orden exacto que indica el Bloque 0. No empieces
a generar código hasta tenerlas.
```

---

## 📋 BLOQUE 1 — Autenticación y Multi-Tenant

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente la Regla 3
  (Row-Level Security) y la Regla 14 (Audit Log global).
- La sección BLOQUE 1 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Monorepo creado (apps/api + apps/web + packages/shared)
✅ Prisma conectado a Supabase — todas las tablas creadas y migradas
✅ Tabla telemetry particionada con PARTITION BY RANGE nativo (Modo A) + pg_cron activo
✅ RLS activado en todas las tablas de negocio
✅ Redis (Upstash) conectado y respondiendo ping
✅ Seed ejecutado: roles, tenant demo, usuario admin, avl_user demo,
   2 vehículos de prueba, carbon_settings
✅ NestJS levanta en localhost:3000
✅ React + Vite levanta en localhost:5173
✅ Variables de entorno en apps/api/.env (no commiteadas)

OBJETIVO DE ESTA SESIÓN:
Login funcional con JWT + Refresh Token. Guards de roles. Tenant
isolation activo via RLS en cada request. Página de login en React
con redirect a /map al autenticarse.

Lee el Bloque 1 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 2 — Ingesta de Telemetría del HUB

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 1 (temperatura/humedad solo del HUB, nunca calculamos),
  Regla 4 (Outbox Pattern obligatorio),
  Regla 7 (campo Alert ignorado),
  Regla 8 (shipment ignorado),
  Regla 9 (User_avl es FUNDAMENTAL),
  Regla 12 (NUNCA descartar datos GPS),
  Regla 13 (NUNCA suprimir alertas),
  Regla 45 (USE_TIMESCALEDB — el INSERT a telemetry es transparente en ambos modos).
- La sección BLOQUE 2 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 (infraestructura, DB, seed)
✅ Todo el Bloque 1 (auth JWT, guards, RLS activo, login en UI)
✅ POST /auth/login retorna JWT válido con claims correctos
✅ Rutas protegidas redirigen a /login si no hay token
✅ TenantMiddleware setea app.current_tenant_id antes de cada query

OBJETIVO DE ESTA SESIÓN:
Pipeline completo de ingesta de telemetría del HUB. El HUB puede enviar
posiciones via API Key, se validan, normalizan, persisten con Outbox, y
la posición aparece en Redis. Módulo AVL Users completo con diccionario
de eventos y panel de códigos desconocidos.

Lee el Bloque 2 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 3 — Gestión de Flota y Geocercas

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 5 (tokens de diseño — ningún color hardcodeado en UI),
  Regla 6 (switches simples para todo),
  Regla 10 (logo Rusertech visible en todas las pantallas),
  Regla 32 (country_code en todas las entidades geográficas),
  Regla 39 (bloqueo de vehículo con email a AVL y cliente — flujo completo),
  Regla 40 (geocercas 1:N recorridos — asignación por recorrido, no global).
- La sección BLOQUE 3 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 y Bloque 1
✅ POST /telemetry/ingest procesa y persiste con Outbox (Bloque 2)
✅ Redis vehicle:position actualizado con cada ingesta
✅ Módulo AVL Users con diccionario de eventos y códigos desconocidos
✅ Deduplicación activa
✅ Anti time-travel activo (is_out_of_order marcado correctamente)
✅ Geocodificación inversa funcionando (Photon/Nominatim OSM, cacheada en Redis)

OBJETIVO DE ESTA SESIÓN:
CRUD completo de vehículos, conductores y operaciones. Switch de
bloqueo de vehículo con flujo completo (modal + email automático a AVL
y cliente — Regla 39). Módulo completo de Ubicaciones (saved_locations)
con mapa interactivo. Módulo de Recorridos agrupados por cliente con
árbol lateral + herramienta de dibujo MapLibre Draw. Geocercas con
editor visual y asignación 1:N a recorridos (Regla 40). Import masivo
de flota con plantilla descargable.

Lee el Bloque 3 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 4 — Viajes y Monitoreo en Tiempo Real

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 12 (nunca descartar GPS — is_out_of_order),
  Regla 16 (RiskLevel es del VIAJE COMPLETO, no de una alerta),
  Regla 17 (ControlZones disparan transiciones de estado),
  Regla 27 (pre-trip validation es advertencia, nunca bloqueo),
  Regla 35 (TripQueryFilterDto — punto único de filtrado),
  Regla 36 (Carga de Viaje sin señal requerida del HUB),
  Regla 41 (fechas de viaje opcionales — inicio y fin no obligatorios),
  Regla 43 (Trip ID visible en confirmación de creación),
  Regla 44 (filtros de recorrido por cliente y tipo en wizard).
- La sección BLOQUE 4 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0, 1, 2 y 3
✅ Vehículos, conductores, operaciones con CRUD completo
✅ Switch de bloqueo con flujo completo (email a AVL + cliente)
✅ Geocercas con editor MapLibre Draw y asignación 1:N a recorridos
✅ Import masivo de vehículos con plantilla descargable
✅ GET /vehicles/live responde < 50ms desde Redis

OBJETIVO DE ESTA SESIÓN:
Ciclo completo de viaje (draft → scheduled → in_progress → completed).
CQRS con comandos de viaje. CreateTripFlow con fechas opcionales (Regla 41),
filtros de recorrido (Regla 44) y Trip ID en confirmación (Regla 43).
Deviation Monitor con PostGIS. Control Zone Monitor. Socket.io hub con
backpressure. Trip detail con mapa en vivo. Pre-trip route validation
con warnings geoespaciales. TripQueryFilterDto con todos los filtros.

Lee el Bloque 4 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 5 — Motor de Eventos y Alertas

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 13 (NUNCA suprimir alertas),
  Regla 18 (geocodificación inversa en todos los eventos),
  Regla 19 (mapas estáticos en emails),
  Regla 23 (WhatsApp como canal de primera clase),
  Regla 26 (Alarm Grouping reduce fatiga sin perder información),
  Regla 28 (alertas ordenadas critical → warning → info SIEMPRE),
  Regla 29 (Trip ID visible en cada alerta),
  Regla 37 (paleta de riesgo — 4 colores únicos, usar tokens correctos),
  Regla 40 (geocercas: evaluar solo las asignadas al recorrido activo).
- La sección BLOQUE 5 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 al 4
✅ Ciclo completo de viaje con CQRS
✅ Deviation Monitor activo (PostGIS ST_Distance)
✅ Control Zone Monitor activo
✅ Socket.io hub con backpressure (batch 500ms)
✅ TripQueryFilterDto con todos los filtros

OBJETIVO DE ESTA SESIÓN:
Motor de evaluación de eventos (EventEvaluator). Todos los evaluadores
de reglas. Notificaciones multi-canal (email, push, WhatsApp, webhook).
Panel de alertas con ordenamiento Regla 28. Exclusiones de alarmas.
Cola de crónicas. Mapas estáticos en emails.

Lee el Bloque 5 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 6 — Layout Principal, Mapa, Vistas y Herramientas

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

LECTURA OBLIGATORIA ANTES DE CUALQUIER CÓDIGO:
1. Lee las REGLAS DE ORO (1 al 45). Especialmente:
   - Regla 33 (CSS del contenedor del mapa — CRÍTICA para evitar mapa negro)
   - Regla 34 (persistencia del layout en localStorage por usuario)
   - Regla 35 (FilterDrawer como único punto de entrada de filtros)
   - Regla 36 (Carga de Viaje sin señal requerida del HUB)
   - Regla 37 (paleta de riesgo: Normal🟢 Elevado🟡 Alto🟠 Crítico🔴)
   - Regla 38 (tooltips persistentes en todo el sistema — estándar UX)
   - Regla 39 (bloqueo de vehículo: modal + email a AVL y cliente)
   - Regla 40 (geocercas 1:N recorridos — asignación por recorrido)
   - Regla 41 (fechas opcionales en CreateTripFlow)
   - Regla 42 (Analytics: período default = mes calendario actual)
   - Regla 43 (Trip ID en pantalla de confirmación)
   - Regla 44 (filtros de recorrido por cliente y tipo)
   - Regla 5  (tokens de diseño — ningún color hardcodeado)
   - Regla 10 (logo visible en todas las pantallas)
   - Regla 28 (alertas ordenadas critical→warning→info SIEMPRE)
   - Regla 29 (Trip ID en cada alerta)
   - Regla 31 (MapLibre GL JS + OpenFreeMap — sin Mapbox, sin API key)

2. Lee la sección BLOQUE 6 completa del Master Prompt v4.0.
   Es la sección más extensa. Contiene specs de 10+ componentes.

3. Lee el archivo rusertech_prototype_v4_1.jsx COMPLETO.
   Es la referencia visual APROBADA. Los tokens C, G, T del prototipo
   mapean exactamente a los archivos del Design System.
   NO copiar el SVG del mapa — implementar MapLibre GL JS v4 real.
   SÍ respetar la estructura de componentes, colores y comportamientos.
   El prototipo v4.1 cubre todas las vistas, modales y flujos del Bloque 6.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 al 5
✅ Motor de eventos con todos los evaluadores
✅ Alertas generando notificaciones por todos los canales
✅ RiskLevel Engine calculando y emitiendo cambios via Socket.io
✅ Panel de alertas actualizado en tiempo real
✅ Exclusiones de alarmas configurables con wizard
✅ TripQueryFilterDto implementado con todos los filtros
✅ Prototipo v4.1 aprobado como referencia visual del Bloque 6

OBJETIVO DE ESTA SESIÓN:
Layout completo con paneles redimensionables (Regla 34). Mapa MapLibre
GL JS v4 (OpenFreeMap tiles) con marcadores animados y todas las capas
(Regla 33 CSS). FilterDrawer con 6 grupos y TripQueryFilterDto integrado
(Regla 35). Todas las NavTabs funcionales (Mapa/Viajes/Alertas/Flota/
Geocercas/Analytics). MapToolbar con 9 botones funcionales. DrawingPanel
con asignación de geocercas a recorridos (Regla 40). CreateTripFlow con
fechas opcionales (Regla 41), filtros de recorrido (Regla 44) y Trip ID
en confirmación (Regla 43). Tooltips en todo el sistema (Regla 38).
Modal de bloqueo con email a AVL y cliente (Regla 39). Paleta de riesgo
con 4 colores únicos (Regla 37). Analytics con selector de período (Regla 42).

ATENCIÓN ESPECIAL — Regla 33 (CSS del mapa):
El contenedor padre del mapa DEBE tener:
  style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}
← minHeight:0 es CRÍTICO. Sin él el contenedor colapsa y el mapa queda negro.
El canvas dentro usa: position:'absolute', inset:0, width:'100%', height:'100%'
Al inicializar: map.on('load', () => { map.resize(); loadAllLayers(map); })

ATENCIÓN ESPECIAL — Paleta de riesgo (Regla 37):
  Normal   → riskNormal  = '#22C55E' (verde)
  Elevado  → riskElevado = '#EAB308' (amarillo)
  Alto     → riskAlto    = '#F97316' (naranja)
  Crítico  → riskCritico = '#EF4444' (rojo)
  NUNCA usar statusWarning (#F59E0B) para el nivel de riesgo.

Lee el Bloque 6 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 7 — Temperatura, Humedad y Sensores

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 1 (temperatura y humedad VIENEN DEL HUB — no calculamos nada),
  Regla 2 (son módulos completamente separados de la huella de carbono),
  Regla 6 (switches simples para activar/desactivar configuraciones),
  Regla 38 (tooltips en configuraciones de sensores),
  Regla 45 (USE_TIMESCALEDB — las queries de historial de sensores usan
             date_trunc() si false, time_bucket() si true. El
             TelemetryQueryService abstrae el modo — no hardcodear).
- La sección BLOQUE 7 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 al 6
✅ Layout completo con paneles redimensionables
✅ Mapa MapLibre con marcadores, capas y herramientas de dibujo
✅ FilterDrawer con 6 grupos integrado con TripQueryFilterDto
✅ Todas las NavTabs funcionales
✅ MapToolbar con todos los botones funcionales
✅ DrawingPanel con asignación de geocercas a recorridos
✅ CreateTripFlow con fechas opcionales, filtros y Trip ID

ESTADO DE TEMPERATURA Y HUMEDAD hasta ahora:
- Los campos temperature_c y humidity_pct ya se persisten en telemetry
  desde el Bloque 2 (ingesta).
- El badge de temperatura ya aparece en los marcadores del mapa
  desde el Bloque 6.
- Este bloque construye el dashboard completo de sensores.

OBJETIVO DE ESTA SESIÓN:
Dashboard de sensores con cards por vehículo, gauge semicircular,
sparklines y estados semánticos. Gráficos históricos con particionamiento
temporal (date_trunc / time_bucket según modo). Configuración de rangos (min/max/tolerancia/delta) con
switch individual. Modal de detalle con selector de período.

Lee el Bloque 7 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 8 — Huella de Carbono y Analytics

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Especialmente:
  Regla 2 (huella de carbono es cálculo INTERNO — separado de temperatura),
  Regla 6 (switch on/off para Climatiq API),
  Regla 24 (xlsx en todos los exports donde existe CSV),
  Regla 37 (paleta de riesgo — usar tokens correctos en gráficos),
  Regla 42 (Analytics: período por defecto = mes calendario actual,
             selector permite semana o mes completo — sin rangos custom),
  Regla 45 (USE_TIMESCALEDB — las queries de analytics usan date_trunc()
             si false, time_bucket() si true. TelemetryQueryService
             abstrae el modo. Los resultados son idénticos para el frontend).
- La sección BLOQUE 8 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 al 7
✅ Dashboard de sensores con temperatura y humedad en tiempo real
✅ Alertas de temperatura y humedad por rangos configurados

OBJETIVO DE ESTA SESIÓN:
Carbon Footprint Calculator (fórmula interna + Climatiq API toggleable).
Dashboard de carbono con comparativo mes anterior. Dashboard de analytics
con KPIs, gráficos ECharts, selector de período (mes/semana — Regla 42)
y filtros. Exports CSV y XLSX. PDF reporte.

ATENCIÓN ESPECIAL:
- Los gráficos ECharts deben usar EXACTAMENTE la paleta del Design System.
  Ningún color de ECharts por defecto. Los colores vienen de los tokens.
  Incluye los tokens de riesgo (riskNormal, riskElevado, riskAlto, riskCritico).
- El dashboard de Analytics arranca mostrando el mes calendario actual (Regla 42).
- La vista Analytics del Bloque 6 ya tiene el layout/navegación.
  Este bloque completa el contenido real con datos de telemetría particionada.

Lee el Bloque 8 completo antes de escribir cualquier código.
```

---

## 📋 BLOQUE 9 — Administración Multi-Tenant y Deployment HTTPS

```
Hola. Continuamos con el proyecto Rusertech. El Master Prompt v4.0
está cargado en tu contexto.

Antes de continuar, relee:
- Las REGLAS DE ORO del Master Prompt (1 al 45). Todas aplican.
  Este es el bloque final — todo lo construido debe estar integrado.
  Especialmente:
  Regla 3  (RLS en producción — verificar en Supabase Dashboard),
  Regla 10 (logo Rusertech visible en TODAS las pantallas),
  Regla 20 (ParameterSettings — tabla de configuración viva sin deploy),
  Regla 21 (AVL Simulator NUNCA en producción),
  Regla 22 (Position Forwarding separado de webhooks de alertas),
  Regla 34 (layout persistence — verificar que funciona en producción),
  Regla 37 (paleta de riesgo — verificar tokens en producción),
  Regla 38 (tooltips activos en toda la UI de producción),
  Regla 39 (email de bloqueo configurado con SMTP del tenant).
- La sección BLOQUE 9 completa.

ESTADO ACTUAL DEL PROYECTO — lo siguiente está funcionando:
✅ Todo el Bloque 0 al 8 completo
✅ Pipeline de ingesta end-to-end
✅ Motor de eventos con todos los evaluadores y notificaciones
✅ Viajes con ciclo completo y monitoreo en tiempo real
✅ Mapa principal con todas las capas y herramientas
✅ Sensores, analytics y carbono
✅ AVL Simulator activo en desarrollo (AVL_SIMULATOR_ENABLED=true)
✅ Position Forwarding funcionando con circuit breaker

OBJETIVO DE ESTA SESIÓN:
Panel de administración multi-tenant (rusertech_admin). Onboarding de
nuevos clientes con email de bienvenida. Módulo de settings completo.
Configuración de canales de notificación. HTTPS con Nginx + Let's Encrypt.
Docker Compose de producción. Health check endpoint.

CHECKLIST DE PRODUCCIÓN:
□ AVL_SIMULATOR_ENABLED=false en .env.prod
□ Logo Rusertech visible en login, mapa, sidebar y emails
□ Layout persistence funciona (localStorage no bloqueado en producción)
□ RLS verificado en Supabase Dashboard
□ SSL activo y HTTP → HTTPS redirect funcionando
□ Socket.io en wss:// (no ws://)
□ FilterDrawer funciona en todas las vistas
□ Paleta de riesgo correcta (riskNormal/Elevado/Alto/Critico) en producción
□ Tooltips visibles en producción (no bloqueados por CSS de prod)
□ Email de bloqueo de vehículo: SMTP configurado + templates cargados

Lee el Bloque 9 completo antes de escribir cualquier código.
```

---

## 📌 REFERENCIA RÁPIDA — Qué decir cuando algo falla

### Si el IDE "olvida" una regla:
```
Atención: estás violando la Regla [N] del Master Prompt v4.0.
Releela y corrige antes de continuar.
La regla dice: [copiar la regla exacta del Master Prompt]
```

### Si el mapa aparece negro:
```
Atención: el mapa negro viola la Regla 33 del Master Prompt v4.0.
Verifica las tres condiciones:
1. El contenedor padre tiene: flex:1, position:relative, overflow:hidden, minHeight:0
2. El div del canvas tiene: position:absolute, inset:0, width:100%, height:100%
3. El callback map.on('load') llama map.resize() antes de cargar capas
Corrige estas tres condiciones antes de continuar.
```

### Si los colores de riesgo son incorrectos:
```
Atención: violación de la Regla 37 del Master Prompt v4.0.
La paleta de riesgo tiene 4 colores únicos — ninguno se repite:
  Normal   → riskNormal  = '#22C55E' (verde)
  Elevado  → riskElevado = '#EAB308' (amarillo)
  Alto     → riskAlto    = '#F97316' (naranja)
  Crítico  → riskCritico = '#EF4444' (rojo)
No usar statusWarning (#F59E0B) para niveles de riesgo.
No usar el mismo color para Elevado y Alto.
```

### Si un tooltip no es persistente:
```
Atención: violación de la Regla 38 del Master Prompt v4.0.
Los tooltips desaparecen SOLO al retirar el mouse — nunca con temporizador.
Verificar que el componente Tooltip use onMouseEnter/onMouseLeave.
```

### Si el bloqueo de vehículo no envía email:
```
Atención: violación de la Regla 39 del Master Prompt v4.0.
El flujo de bloqueo debe:
1. Mostrar modal con última posición conocida + campo comentario obligatorio
2. Al confirmar: bloquear ingesta + enviar email al AVL + enviar email al cliente
3. Registrar en audit_log con todos los datos
```

### Si una geocerca aplica globalmente en lugar de por recorrido:
```
Atención: violación de la Regla 40 del Master Prompt v4.0.
Las geocercas se asignan POR RECORRIDO, no globalmente al tenant.
El motor de eventos evalúa solo las geocercas asignadas al recorrido
activo del vehículo. Verificar la lógica de asignación en DB.
```

### Si las fechas de viaje son obligatorias:
```
Atención: violación de la Regla 41 del Master Prompt v4.0.
Inicio y fin planificado son OPCIONALES en CreateTripFlow.
Usar checkbox "Definir [inicio/fin]" → datepicker condicional.
Sin fecha: el viaje se crea sin ventana temporal definida.
```

### Si hay un filtro hardcodeado fuera del FilterDrawer:
```
Atención: violación de la Regla 35 del Master Prompt v4.0.
No se crean inputs de filtro inline dispersos por las vistas.
Todos los filtros van a través del FilterDrawer + TripQueryFilterDto.
Refactorizar para usar el mecanismo unificado.
```

### Si el ID del viaje no aparece en la confirmación:
```
Atención: violación de la Regla 43 del Master Prompt v4.0.
Al crear un viaje, el ID debe mostrarse prominentemente en la
pantalla de confirmación. Ejemplo: "Viaje creado — ID: #52"
con badge accentBlue (#2AB3FF) y tipografía monospace.
```

### Si el paso de selección de recorrido no tiene filtros:
```
Atención: violación de la Regla 44 del Master Prompt v4.0.
El paso 2 del CreateTripFlow DEBE tener:
- Filtro por cliente (dropdown)
- Filtro por tipo de operación (dropdown)
- Contador de resultados ("N recorridos encontrados")
Ambos filtros son opcionales pero deben estar presentes.
```

### Si el sitio público importa componentes del SaaS:
```
Atención: violación de la Regla 46 del Master Prompt v4.0.
PublicLayout y las páginas públicas NO deben importar:
  - Socket.io ni useSocket
  - Zustand stores del SaaS (useLayoutStore, useAuthStore del SaaS, etc.)
  - Componentes de telemetría, mapas o alertas del SaaS
El único puente permitido entre el sitio público y el SaaS es la ruta /login.
Refactorizar para que el Layout Público sea completamente independiente.
```

### Si el usuario logueado no redirige desde el sitio público:
```
Atención: violación de la Regla 46b del Master Prompt v4.0.
Todas las páginas públicas deben implementar PublicGuard:
  const { token } = useAuthStore();
  if (token) return <Navigate to="/map" replace />;
Este guard debe ejecutarse antes de renderizar cualquier contenido público.
```

### Si la query de telemetría falla con "function time_bucket does not exist":
```
Atención: violación de la Regla 45 del Master Prompt v4.0.
time_bucket() es exclusivo de TimescaleDB (USE_TIMESCALEDB=true).
Con USE_TIMESCALEDB=false usar el equivalente nativo:
  date_trunc('minute', timestamp) -
  INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp)::int % 5)
El TelemetryQueryService debe detectar process.env.USE_TIMESCALEDB
y usar la query correspondiente. Nunca hardcodear time_bucket().
```

### Si un ítem del checklist falla:
```
El ítem [□ descripción exacta del checklist] falló.
Error exacto: [pegar el error de la terminal o consola]
Corrige solo este punto sin tocar lo que ya funciona.
```

### Si el IDE avanza sin validar:
```
Stop. No avances al siguiente punto.
El ítem anterior del checklist no está verificado.
Primero confirmemos que [ítem] funciona correctamente.
```

### Si hay una decisión de negocio no especificada:
```
Esto no está definido en el Master Prompt v4.0.
Pausa y esperá mi respuesta antes de asumir nada.
Mi decisión es: [tu decisión]
```

---

*Documento: RUSERTECH_SESSION_STARTERS*
*Versión: 1.6 — Compatible con Master Prompt v4.0*
*Referencia visual: rusertech_prototype_v4_1.jsx*
*Usar siempre con el Master Prompt v4.0 cargado en el IDE*
*Versión anterior v1.5 queda archivada — no usar en paralelo con este archivo*
