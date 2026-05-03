# 🛰️ RUSERTECH — MASTER BUILD PROMPT v4.0
## Plataforma SaaS de Seguimiento Satelital Vehicular
### Stack: TypeScript · NestJS · React · PostgreSQL/Supabase · Redis/Upstash
**Empresa:** Rusertech — Seguridad & Logística
**Versión:** 4.0 | **Fecha:** Abril 2026

> **📌 INSTRUCCIÓN DE CARGA:**
> Este documento es la **versión vigente y COMPLETA**. Reemplaza al v3.9.
> Cargar ÚNICAMENTE este archivo. El v3.9 queda archivado — no usar en paralelo.

> **Changelog v4.0 (vs v3.9 — Sitio Público y Marketing integrado al blueprint):**
> - Regla 46: Sitio Público — tokens compartidos con el SaaS, enrutamiento 100% independiente
> - PARTE 0 agregada: "SITIO PÚBLICO Y MARKETING" — previa a los bloques de infraestructura
> - BLOQUE -1 agregado: Landing Page pública (React frontend only, sin NestJS)
>   Rutas: `/` `/nosotros` `/servicios` `/contacto` `/login`
>   Layout Público con Header y Footer propios, aislado del AppLayout del SaaS
>   Redirección automática a `/map` si el usuario ya tiene sesión activa
>   Contenido orientado a conversión B2B: Hero, Features, CTA, Formulario de contacto
> - Site oficial: rusertech.com
>
> **Changelog v3.9 (vs v3.8 — estrategia de persistencia telemetría + compatibilidad Supabase Free):**
> - Regla 45: USE_TIMESCALEDB — toggle de entorno, por defecto FALSE (PostgreSQL nativo)
> - Tabla `telemetry` rediseñada con doble estrategia de particionamiento:
>   SECCIÓN A (default): `PARTITION BY RANGE` nativo PostgreSQL + `pg_cron` auto-particiones
>   SECCIÓN B (opcional): TimescaleDB hypertable cuando `USE_TIMESCALEDB=true`
> - Archivos de migración separados: `001_telemetry_partitioned.sql` y `001_telemetry_hypertable.sql`
> - `pg_cron` job incluido para auto-crear particiones mensuales futuras (compatible Supabase Free)
> - Queries `time_bucket` reemplazadas por equivalente `date_trunc` nativo en Bloques 7 y 8
> - Índices GIST corregidos para sintaxis de tabla particionada
> - Bloque 0: instrucciones de setup bifurcadas por `USE_TIMESCALEDB`
> - Checklist Bloque 0 actualizado (sin TimescaleDB obligatorio)
> - Site oficial registrado: rusertech.com
>
> **Changelog v3.8 (vs v3.7 — feedback de prototipo UI v4.1 + decisiones de negocio confirmadas):**
> - `rusertech_prototype_v4_1.jsx` reemplaza a `rusertech_prototype_v3.jsx` como referencia visual oficial del Bloque 6
> - Regla 37: Paleta de riesgo — 4 colores únicos diferenciados (Normal/Elevado/Alto/Crítico)
> - Regla 38: Tooltips como estándar de UX en todo el sistema
> - Regla 39: Bloqueo de vehículo — flujo con email automático a AVL y cliente
> - Regla 40: Geocercas 1:N recorridos — asignación libre por recorrido, no global
> - Regla 41: Fechas de viaje opcionales — inicio y fin no son campos obligatorios
> - Regla 42: Analytics — período por defecto mes calendario actual, selector semana/mes
> - Regla 43: Trip ID visible en pantalla de confirmación al crear viaje
> - Regla 44: Filtros de recorrido por cliente y tipo de operación en CreateTripFlow
> - Design System: nuevos tokens `riskNormal`, `riskElevado`, `riskAlto`, `riskCritico`
> - Columna "Temperatura" en vista Flota reemplazada por "Última señal"
> - Todo el sistema en español (labels, estados, placeholders, botones)
> - Ordenamiento por columna en vista Viajes (click en header asc/desc)
> - Modal de Nuevo Vehículo funcional + Import CSV con plantilla descargable
> - Tabla `route_geofences` agregada al modelo de DB (pivote Geocercas ↔ Recorridos, Regla 40)
>
> **Changelog v3.7 (vs v3.6):**
> - `rusertech_prototype_v3.jsx` es la referencia visual oficial del Bloque 6
> - FilterDrawer: 6 grupos unificados basados en TripQueryFilterDto (Regla 35)
> - TripQueryFilter DTO: único punto de filtrado en backend
> - Paneles drag-resize: splitter izquierdo + BottomPanel drag-resize
> - Navigation views: 6 vistas funcionales (Mapa/Viajes/Alertas/Flota/Geocercas/Analytics)
> - MapToolbar: comportamiento definido para cada uno de los 8 botones
> - DrawingPanel: entrada unificada para herramientas de dibujo
> - Regla 33: Map container CSS fix (previene mapa negro en React)
> - Regla 34: Layout persistence en localStorage por usuario
> - Regla 35: FilterDrawer único punto de filtros → TripQueryFilterDto
> - Regla 36: Carga de Viaje — activación del HUB sin señal requerida

> **Changelog v3.6 (vs v3.5 — feedback de prototipo UI + decisiones de arquitectura):**
> - MapLibre GL JS + OpenFreeMap reemplaza Mapbox GL JS completamente. Sin API key, sin costo, MIT.
> - Email de alerta: template único estandarizado con bloque de ubicación configurable (Geoapify / Node staticmap / Solo texto)
> - KML import/export: import con selector de LineString si hay múltiples; export aplica a Recorridos, Geocercas y Viajes históricos
> - Detección de recorridos similares: ST_DWithin 500m en origen y destino, configurable desde ParameterSettings
> - Recorridos genéricos: operation_id NULL = temporal/genérico, visible para todos los operadores del tenant
> - country_code (ISO 3166-1 alpha-2) en todas las entidades geográficas: agrupa, filtra y exporta por país de operación
> - Alertas ordenadas: critical → warning → info + tiempo DESC (Regla 28)
> - Trip ID en cada fila de alerta (Regla 29)
> - Risk Simulator: exclusivo rusertech_admin (Regla 30)
>
> **Changelog v3.5 (vs v3.4 — feedback de prototipo UI):**
> - Ubicaciones + Recorridos: entidades reutilizables separadas del viaje
> - Jerarquía: Ubicaciones → Clientes → Recorridos → Viajes
> - Alertas ordenadas por criticidad (critical primero, luego warning, luego info, dentro de cada nivel por hora desc)
> - Trip ID explícito en cada fila de alerta junto a la placa
> - Risk Simulator: acceso exclusivo a rusertech_admin — nadie más lo ve
> - Mapa: proveedor MapLibre GL JS 4 fijo por arquitectura, no configurable por usuario final

> **Changelog v3.4 (vs v3.3 — incorpora análisis de Tests de SIMON):**
> - NoSignalZone: zonas de pérdida de señal esperada por geografía. Pre-trip warning + alerta enriquecida con contexto (NO supresión — el operador no baja la guardia)
> - Alarm Grouping: agrupación de alarmas del mismo tipo por distancia/tiempo (reduce fatiga de notificaciones)
> - Pre-trip Route Validation: validación geoespacial de la ruta antes de salir (cruces con danger_zones, no_signal_zones, restricted_zones)
> - Vehicle Bulk Import: importación masiva de flota via CSV/XLSX con reporte de errores
>
> **Changelog v3.3 (vs v3.2 — incorpora análisis Frontend, Arquitectura y Evaluación de SIMON):**
> - AVL Simulator: herramienta de dev/staging para testear el pipeline completo sin hardware GPS real
> - WhatsApp: 5to canal de notificación en event_rules (via abstracción INotificationChannel)
> - Position Forwarding (HubDistributor): reenvío configurable de posiciones en tiempo real a sistemas externos
> - Reportes Excel: export xlsx en analytics y viajes (exceljs — sin licencia EPPlus)
>
> **Changelog v3.2 (vs v3.1 — incorpora análisis de SIMON 4.0):**
> - RiskLevel: sistema de scoring dinámico por puntos (supera a SIMON) — 4 niveles
> - ControlZone: zonas que disparan transiciones de estado del viaje (auto o manual por cliente)
> - AlarmTypeExclusion + estado del viaje: nueva dimensión de supresión por TrackingFlowStatus
> - ParameterSetting: tabla de configuración global/tenant que altera el motor en runtime
> - Geocodificación inversa: Nominatim/Photon (OSM — sin API key) en todos los eventos y alertas
> - Mapas estáticos en notificaciones: Proveedor configurable de mapa estático en emails (Geoapify / staticmap / solo texto)

---

> ## 📌 INSTRUCCIÓN DE USO PARA EL IDE
>
> Este archivo es el **contexto maestro permanente** de la sesión. Debe estar cargado
> y visible durante toda la construcción del proyecto.
>
> **Cómo proceder:**
> - Cada sección `### 🔨 BLOQUE X` es un prompt autocontenido y secuencial.
> - Copiar el bloque completo y pegarlo en el chat del IDE.
> - **No avanzar al siguiente bloque hasta que el actual compile, corra y pase su checklist de validación.**
> - Si se inicia una sesión nueva, recargar este archivo y decirle al IDE:
>   *"Contexto: proyecto Rusertech. Estamos en el Bloque X. Esto es lo que ya funciona: [resumen]"*
>
> **Cuando el IDE necesite credenciales externas, pausará y pedirá los datos.**
> No continúa hasta recibirlos. Eso ocurre en el Bloque 0.

---

# PARTE I — FUNDAMENTOS DEL SISTEMA

---

## 🎯 VISIÓN DEL PRODUCTO

Rusertech es una plataforma SaaS empresarial multi-tenant de seguimiento satelital vehicular.
Recibe datos de posición GPS desde un HUB externo (prestadores de servicio GPS) y los
transforma en inteligencia operativa: monitoreo de flotas en tiempo real, gestión de viajes,
motor de eventos configurable, alertas automáticas y analítica avanzada.

**No es** un refactor de SIMON 4.0. Es un producto independiente y nuevo que toma
el conocimiento de dominio de SIMON como referencia de funcionalidades mínimas,
y lo supera en arquitectura, tecnología, UX y capacidad de escala.

---

## ⚠️ REGLAS DE ORO — NUNCA ROMPER

```
1. TEMPERATURA Y HUMEDAD vienen del HUB. Solo recibimos, guardamos y alertamos. No calculamos.
2. HUELLA DE CARBONO es cálculo interno (km + velocidad + modelo vehículo + Climatiq API).
   Son módulos COMPLETAMENTE SEPARADOS. Nunca confundirlos.
3. ROW-LEVEL SECURITY en PostgreSQL/Supabase para TODA tabla de negocio.
   Nunca filtrar tenants solo en código.
4. OUTBOX PATTERN obligatorio en telemetría. Transacción atómica: dato + mensaje juntos.
5. TOKENS DE DISEÑO siempre. Ningún color, tamaño o fuente hardcodeado en UI.
6. SWITCHES SIMPLES para todo: activar/desactivar alertas, bloquear vehículos, toggle Climatiq.
7. El campo `Alert` del payload legacy de SIMON se ignora. Solo guardamos en raw_payload.
8. `shipment` del HUB no se utiliza en lógica. Solo raw_payload.
9. `User_avl` es FUNDAMENTAL y OBLIGATORIO. Es la identidad del dispositivo AVL.
   Sin User_avl no hay ingesta válida. Es la clave de resolución de toda la configuración.
   Tiene su propia entidad, su propio diccionario de eventos y su propio módulo de UI.
10. LOGO Rusertech visible en todas las pantallas de la aplicación.
11. Cada bloque debe compilar y validar antes de avanzar al siguiente.
12. NUNCA DESCARTAR DATOS GPS. Los puntos out-of-order se guardan y se reordenan
    cronológicamente para visualización. La máquina de estados usa solo datos en orden,
    pero el registro histórico conserva todo.
13. NUNCA SUPRIMIR ALERTAS. Las alertas recurrentes (AlarmChronic) van a cola ordenada.
    El operador decide qué hacer con ellas. El sistema nunca toma esa decisión solo.
14. AUDIT LOG GLOBAL. Todo cambio en cualquier dato del sistema queda registrado:
    quién lo hizo, cuándo, valor anterior y valor nuevo. Sin excepción.
15. RUSERTECH ES SUPERADOR. Cada funcionalidad de SIMON 4.0 debe implementarse
    mejorada. Más inteligente, más configurable, más simple de operar.
16. RISKLEVEL es el estado de riesgo del VIAJE COMPLETO — no de una alerta individual.
    Se calcula por scoring acumulado de factores. Escala automáticamente.
    El operador ve el riesgo del viaje de un vistazo, no solo alertas sueltas.
17. CONTROL ZONES disparan transiciones de estado del viaje geográficamente.
    Son diferentes a las geocercas de alerta. Son puntos operativos: origen, destino,
    waypoints. El comportamiento (auto vs manual) es configurable por cliente.
18. GEOCODIFICACIÓN INVERSA en todos los eventos. Toda alerta, evento y notificación
    debe mostrar la dirección legible (calle, ciudad) además de las coordenadas.
    Usar Nominatim/Photon (OSM — sin API key). Cachear resultados en Redis por 24h.
19. MAPAS ESTÁTICOS en emails de alerta. Cada notificación por email incluye
    una imagen del mapa con el pin exacto donde ocurrió el evento.
    Usar proveedor de mapa estático configurado en tenant.settings_json.static_map_provider
20. PARAMETER SETTINGS: tabla de configuración viva que el operador ajusta desde UI
    sin necesidad de deploy. Controla umbrales del motor de reglas en runtime.
21. AVL SIMULATOR solo en dev/staging. Nunca en producción.
    Controlado por variable de entorno AVL_SIMULATOR_ENABLED=true.
    Permite testear el pipeline completo (ingesta → motor → alertas → Socket.io)
    sin hardware GPS real. Es una herramienta del equipo, no una feature de producto.
22. POSITION FORWARDING es diferente a los webhooks de alertas.
    Los webhooks notifican EVENTOS puntuales (alerta disparada).
    El forwarding envía el STREAM CONTINUO de posiciones a sistemas externos.
    Son dos mecanismos independientes, con configuración y tabla propias.
23. WHATSAPP es un canal de notificación de primera clase, igual que email.
    Toda la lógica de notificaciones usa INotificationChannel — nunca se llama
    directamente a una implementación. Si mañana cambia el proveedor de WhatsApp,
    solo cambia el adaptador, no el motor de eventos.
24. EXCEL (xlsx) en todos los exports donde existe CSV.
    El operador elige el formato. Nunca ofrecer uno sin el otro.
25. NO_SIGNAL_ZONES no suprimen alertas. Nunca.
    Cuando un vehículo pierde señal en una zona muerta conocida, la alerta
    signal_loss se genera igual — pero enriquecida con contexto:
    "Pérdida de señal en zona muerta conocida: [nombre]."
    La razón: la señal puede recuperarse por cambios de antena o cobertura.
    El operador debe estar prevenido, no dormido. El sistema informa, no decide.
26. ALARM GROUPING reduce fatiga, no suprime información.
    Cuando el mismo tipo de alarma se dispara múltiples veces en corta distancia
    o tiempo, se agrupan en una notificación con contador. El registro en
    event_logs es SIEMPRE individual y completo. Solo la NOTIFICACIÓN se agrupa.
27. PRE-TRIP VALIDATION es una advertencia, no un bloqueo.
    Si la ruta dibujada cruza zonas de peligro, zonas sin señal o zonas
    restringidas, el sistema advierte con detalle en el mapa.
    El operador puede reconocer la advertencia y continuar, o redibujar la ruta.
    Nunca se bloquea la creación del viaje por este motivo.
28. ALERTAS ordenadas por criticidad SIEMPRE. En cualquier panel, lista o
    notificación: critical primero, warning segundo, info tercero.
    Dentro de cada nivel: hora descendente (más reciente primero).
    Nunca mostrar una alerta warning antes de una critical activa.
29. TRIP ID visible en cada alerta. Toda alerta, fila de panel y notificación
    que esté asociada a un viaje debe mostrar el ID del viaje (#42) junto
    a la placa del vehículo. Sin viaje activo: mostrar "Sin viaje".
30. RISK SIMULATOR exclusivo de rusertech_admin. Ningún otro rol puede
    acceder a esa herramienta. No aparece en menú, no es accesible por URL
    directa, no existe en producción para otros roles. Es una herramienta
    interna de configuración y testing, no una feature del producto.
31. MAPLIBRE GL JS + OPENFREEMAP es el stack de mapas. Sin excepción.
    Mapbox GL JS no existe en este proyecto. Sin API keys de mapas.
    Sin costos de tiles. La URL de tiles es:
    https://tiles.openfreemap.org/styles/bright
    Todo el código de mapas usa la API de MapLibre, no la de Mapbox.
32. COUNTRY_CODE (ISO 3166-1 alpha-2) en todas las entidades geográficas.
    Ubicaciones, Recorridos, Geocercas, Zonas sin señal, Zonas de control.
    La UI agrupa y filtra por país. El export KML filtra por country_code.
    No es una capa jerárquica — es un campo en cada entidad para organización
    operativa multi-país y portabilidad de configuraciones entre entornos.

33. MAP CONTAINER CSS — REGLA DE ARQUITECTURA (v3.7):
    El contenedor padre del mapa MapLibre DEBE tener:
      position: relative;  flex: 1;  overflow: hidden;  min-height: 0;
    ← min-height: 0 es CRÍTICO. Sin él, el contenedor colapsa a 0px en
      un layout flex y el mapa queda completamente negro.
    El canvas de MapLibre dentro del contenedor usa:
      position: absolute;  inset: 0;  width: 100%;  height: 100%;
    Al inicializar el mapa:
      map.on('load', () => { map.resize(); loadAllLayers(map); });
    Sin estas tres piezas juntas, el mapa aparece negro al primer render
    en React. No hay excepción a esta regla.

34. LAYOUT PERSISTENCE (v3.7):
    Los anchos/altos de paneles y sus estados collapsed/expanded persisten
    en localStorage bajo la clave 'rusertech:layout:{userId}'.
    Defaults: { panelWidth: 340, bottomHeight: 185, bottomCollapsed: false }.
    La persistencia es por usuario — cada operador mantiene su configuración.
    El Zustand useLayoutStore lee estos valores al montar AppLayout.

35. FILTERDRAWER ES EL ÚNICO PUNTO DE FILTROS AVANZADOS (v3.7):
    No existen inputs de filtro inline dispersos en las vistas.
    Todos los filtros → FilterDrawer → TripQueryFilterDto en backend.
    Las pills rápidas del FleetPanel son subconjunto de acceso rápido;
    internamente generan el mismo DTO que FilterDrawer.
    Un único query path en backend, extensible sin tocar N pantallas.

36. CARGA DE VIAJE — ACTIVACIÓN DEL HUB (v3.7):
    Al declarar un viaje, el sistema NO envía instrucciones al HUB.
    El viaje puede crearse en estado 'scheduled' o 'in_progress' aunque
    el vehículo no tenga señal reciente en Redis.
    Cuando el HUB envíe datos para ese vehicleId, el pipeline los procesa
    y los asocia al viaje activo normalmente.
    Si hay datos en Redis: mostrar como "última posición conocida".
    Si no hay datos: badge "Sin señal reciente" hasta el primer dato del HUB.
    El HUB envía lo que tiene activado en su sistema — Rusertech solo
    procesa lo que llega con API Key válida. No controla el HUB.

37. PALETA DE RIESGO — 4 COLORES ÚNICOS (v3.8):
    Los niveles de riesgo del viaje tienen cada uno un color diferente.
    Ninguno se repite. Los tokens son:
      riskNormal:  '#22C55E'  — NORMAL   → Verde
      riskElevado: '#EAB308'  — ELEVADO  → Amarillo
      riskAlto:    '#F97316'  — ALTO     → Naranja
      riskCritico: '#EF4444'  — CRÍTICO  → Rojo pulsante
    En v3.7 el nivel ALTO usaba el mismo color ámbar que ELEVADO (error).
    Desde v3.8: ELEVADO=#EAB308 (amarillo), ALTO=#F97316 (naranja) — siempre distintos.
    statusWarning (#F59E0B) sigue existiendo para alertas individuales.
    riskAlto (#F97316) es exclusivo del nivel de riesgo ALTO del viaje.
    Nunca intercambiar estos tokens entre sí.

38. TOOLTIPS — ESTÁNDAR DE UX EN TODO EL SISTEMA (v3.8):
    Todo botón, campo o concepto no obvio debe tener un tooltip explicativo.
    Los tooltips aparecen al hacer hover y desaparecen SOLO al retirar el mouse.
    Nunca usar temporizador para ocultar tooltips automáticamente.
    El componente Tooltip es reutilizable y acepta posición: top/bottom/left/right.
    Casos obligatorios: bloqueo de vehículo, monitoreo reforzado, sensibilidad
    de riesgo (cada opción), botones de la MapToolbar, toggles de geocercas,
    columna de bloqueo en vista Flota.
    El maxWidth del tooltip se ajusta al contenido (default: 220px).

39. BLOQUEO DE VEHÍCULO — FLUJO COMPLETO (v3.8):
    El bloqueo de un vehículo es una acción de emergencia ante robo o situación
    de seguridad comprometida. El flujo completo es:
    a) Operador activa el bloqueo desde mapa, panel de detalle o vista Flota.
    b) Se abre un modal que muestra: última posición conocida, coordenadas,
       dirección geocodificada, fecha/hora, chofer asignado.
    c) El operador ingresa un comentario/novedad (campo obligatorio para bloqueo).
    d) Al confirmar → el sistema:
       - Bloquea la ingesta de datos del HUB para ese vehículo.
       - Envía email automático al prestador AVL con: placa, coordenadas, dirección,
         timestamp y comentario del operador, solicitando inmovilización.
       - Envía email automático al cliente afectado con los mismos datos.
       - Registra la acción completa en audit_log.
    El desbloqueo no requiere comentario obligatorio pero sí confirmación.
    El email de bloqueo es informativo y de solicitud — Rusertech no controla
    directamente el hardware del AVL. La inmovilización la ejecuta el prestador.

40. GEOCERCAS 1:N RECORRIDOS (v3.8):
    Una geocerca o zona se crea UNA VEZ y se asigna libremente a N recorridos.
    Un recorrido puede tener N geocercas asignadas.
    La asignación es POR RECORRIDO, no global al tenant.
    Motor de eventos: al evaluar entrada/salida de geocerca, el sistema verifica
    que la geocerca esté asignada al recorrido activo del vehículo. Si no está
    asignada a ese recorrido, el evento no se dispara (aunque el vehículo entre
    físicamente en la zona).
    En la UI: al guardar una geocerca desde el DrawingPanel, el operador puede
    asignarla a uno o más recorridos con checkboxes (panel de asignación 1:N).
    En la vista Geocercas: al seleccionar una zona, el panel inferior muestra
    los recorridos a los que está asignada actualmente.
    En la tabla de recorridos: cada recorrido muestra el conteo de geocercas
    asignadas como badge informativo.

41. FECHAS DE VIAJE — OPCIONALES (v3.8):
    En el CreateTripFlow (Paso 3), los campos "Inicio planificado" y "Fin planificado"
    son OPCIONALES. No bloquean la creación del viaje si están vacíos.
    En la UI: cada campo tiene un checkbox "Definir [inicio/fin] planificado".
    Al activar el checkbox se despliega el datepicker correspondiente.
    Sin fecha definida: el viaje se crea sin ventana temporal — el sistema no
    calcula ETA ni genera alertas de retraso para ese viaje.
    Con fecha definida: aplica toda la lógica de ETA, retraso y alertas temporales.
    Esta regla permite declarar viajes en curso o sin horario fijo conocido.

42. ANALYTICS — PERÍODO Y SELECTOR (v3.8):
    El período por defecto en el dashboard de Analytics es el MES CALENDARIO
    ACTUAL (ej: si hoy es 28/03/2026, el default es Marzo 2026 completo).
    El selector de período permite elegir entre:
      - Por semana: selector de semana ISO (type="week")
      - Por mes: selector de mes/año (type="month")
    No existen rangos custom de fechas arbitrarias en el MVP.
    Al cambiar el período, todos los KPIs, gráficos y tablas se actualizan
    mostrando los datos del período seleccionado.
    Los gráficos históricos siempre usan la paleta del Design System.
    Nunca usar colores por defecto de ECharts o de librerías de gráficos.

43. TRIP ID EN CONFIRMACIÓN (v3.8):
    Al completar el wizard de creación de viaje y confirmar, la pantalla final
    de confirmación (paso 4 resuelto) debe mostrar el ID del viaje asignado
    de forma PROMINENTE. Ejemplo visual:
      "¡Viaje creado! ID asignado: #52"
    El ID se muestra con badge de color accentBlue (#2AB3FF) y tipografía mono.
    Es el primer dato que el operador debe poder leer y comunicar al equipo.
    Sin este ID visible, el operador no puede referenciar el viaje en comunicaciones
    internas ni hacer seguimiento inmediato.

44. FILTROS DE RECORRIDO EN CREATETRIPFLOW (v3.8):
    En el paso 2 del wizard de creación de viaje (selección de recorrido),
    se deben mostrar SIEMPRE dos filtros antes de la lista de recorridos:
      a) Filtrar por cliente (dropdown con lista de clientes del tenant)
      b) Filtrar por tipo de operación (dropdown con los tipos existentes)
    Ambos filtros son opcionales — con valor vacío muestra todos los recorridos.
    Los filtros se combinan: se puede filtrar por cliente Y tipo simultáneamente.
    Debajo de los filtros: contador de resultados ("N recorridos encontrados").
    Los recorridos filtrados muestran: nombre, tipo de operación (badge),
    país (badge), origen → destino, y cantidad de geocercas asignadas (badge).
    Esta regla previene que operadores con flotas grandes tengan que scrollear
    listas interminables para encontrar el recorrido correcto.

45. USE_TIMESCALEDB — ESTRATEGIA DE PERSISTENCIA DE TELEMETRÍA (v3.9):
    La tabla `telemetry` soporta DOS modos de particionamiento, controlados
    por la variable de entorno USE_TIMESCALEDB (default: false).

    USE_TIMESCALEDB=false (DEFAULT — Supabase Free, cualquier PostgreSQL):
      Usar PARTITION BY RANGE nativo de PostgreSQL particionando por timestamp
      mensualmente. Las particiones se crean vía pg_cron (disponible en Supabase
      Free). El INSERT es transparente — Prisma y el código de aplicación no
      saben si usan modo A o modo B. Las queries usan date_trunc() en lugar de
      time_bucket().

    USE_TIMESCALEDB=true (Supabase Pro o instancia propia con TimescaleDB):
      Usar create_hypertable() de TimescaleDB. Las queries pueden usar
      time_bucket() para agregaciones temporales óptimas.

    ARCHIVOS DE MIGRACIÓN:
      prisma/migrations/001_telemetry_partitioned.sql  ← ejecutar si USE_TIMESCALEDB=false
      prisma/migrations/001_telemetry_hypertable.sql   ← ejecutar si USE_TIMESCALEDB=true
      prisma/migrations/002_telemetry_partition_cron.sql ← ejecutar SIEMPRE si modo=false

    REGLA CRÍTICA: NUNCA ejecutar `prisma migrate dev` para alterar la tabla
    telemetry sin ajustar también los archivos SQL de particiones/hypertable.
    El modelo en schema.prisma usa @@map("telemetry") y es solo para lectura
    de tipos — la estructura real la gestiona el SQL manual.

    EQUIVALENCIA DE QUERIES:
      TimescaleDB: SELECT time_bucket('5 minutes', timestamp), AVG(val) ...
      PostgreSQL nativo: SELECT date_trunc('minute', timestamp) -
        INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp)::int % 5),
        AVG(val) ...
    El TelemetryQueryService detecta el modo via USE_TIMESCALEDB y usa la
    query correspondiente. La interfaz hacia el resto del sistema es idéntica.

46. SITIO PÚBLICO — SEPARACIÓN DE RESPONSABILIDADES (v4.0):
    El sitio público (rusertech.com) usa los mismos tokens del Design System
    que el SaaS interno, pero su enrutamiento y layout son 100% independientes.
    Reglas obligatorias:
    a) El Layout Público (PublicLayout) NO importa ni instancia ningún componente
       de Socket.io, Zustand del SaaS, ni lógica de telemetría.
    b) Si el usuario ya tiene sesión activa (token JWT válido en memoria) e
       intenta navegar a `/`, `/nosotros`, `/servicios` o `/contacto`,
       debe ser redirigido automáticamente a `/map`.
    c) La ruta `/login` existe en el sitio público y carga el formulario de
       autenticación. Es la única ruta pública que conecta con el SaaS.
    d) Todos los colores, fuentes y espaciados del sitio público provienen
       exclusivamente de los tokens del Design System. Cero valores hardcodeados.
    e) El sitio público es solo React frontend. No requiere cambios en NestJS.
       Ningún endpoint nuevo de backend es necesario para el BLOQUE -1.
```

---

## 🎨 RUSERTECH DESIGN SYSTEM

> **Fuente de verdad visual.** Todo componente UI debe importar estos tokens.
> Cualquier valor hardcodeado en UI es un error.

### Paleta de Colores

```typescript
// src/design-system/tokens/colors.ts
export const Colors = {
  // ── Fondo principal — Deep Space Gradient ──
  bgStart:          '#1F2A5A',  // Azul Índigo Profundo (arriba)
  bgEnd:            '#2B2F6E',  // Azul Marino Violáceo (abajo)
  bgSurface:        '#252D6B',  // Cards, panels
  bgSurfaceHigh:    '#2E3578',  // Cards elevadas, dropdowns, modals
  bgOverlay:        'rgba(31,42,90,0.88)',

  // ── Acento — Tech Glow Gradient ──
  accentGreen:      '#7CFF3C',  // Verde Eléctrico
  accentMint:       '#33E1A1',  // Cian Menta
  accentBlue:       '#2AB3FF',  // Azul Cian Eléctrico
  // Uso completo: linear-gradient(135deg, #7CFF3C, #33E1A1, #2AB3FF)

  // ── Texto ──
  textPrimary:      '#E5E7EB',  // Títulos y cuerpo
  textSecondary:    '#9CA3AF',  // Labels, captions
  textMuted:        '#6B7280',  // Disabled, placeholders
  textOnAccent:     '#1F2A5A',  // Texto sobre botones con gradiente

  // ── Símbolo del ícono (escudo/flecha) ──
  iconSymbol:       '#1F2A5A',

  // ── Estados semánticos ──
  statusOnline:     '#22C55E',  // Verde — vehículo activo, en movimiento
  statusWarning:    '#F59E0B',  // Ámbar — desvío, advertencia individual
  statusDanger:     '#EF4444',  // Rojo — alerta crítica, fuera de rango
  statusInfo:       '#3B82F6',  // Azul — en tránsito, informativo
  statusOffline:    '#6B7280',  // Gris — sin señal, inactivo
  statusBlocked:    '#7C3AED',  // Violeta — vehículo bloqueado manualmente

  // ── Riesgo del Viaje — 4 colores únicos (Regla 37, v3.8) ──
  // NUNCA intercambiar estos tokens con statusWarning/statusDanger
  riskNormal:       '#22C55E',  // NORMAL   → Verde
  riskElevado:      '#EAB308',  // ELEVADO  → Amarillo (distinto del ámbar de warning)
  riskAlto:         '#F97316',  // ALTO     → Naranja (distinto del rojo crítico)
  riskCritico:      '#EF4444',  // CRÍTICO  → Rojo pulsante

  // ── Temperatura / Humedad (gradiente semántico) ──
  sensorCold:       '#2AB3FF',  // Bajo rango mínimo
  sensorNormal:     '#33E1A1',  // Dentro de rango
  sensorHot:        '#F59E0B',  // Sobre rango máximo
  sensorCritical:   '#EF4444',  // Zona crítica

  // ── Mapa ──
  mapRoutePlanned:  '#7CFF3C',  // Ruta planificada
  mapRouteActual:   '#E5E7EB',  // Recorrido real
  mapRouteDeviated: '#EF4444',  // Segmento desviado
  mapGeofenceStroke:'#2AB3FF',
  mapGeofenceFill:  'rgba(42,179,255,0.15)',
  mapZoneDanger:    '#EF4444',
  mapZoneDangerFill:'rgba(239,68,68,0.18)',
  mapZoneAlert:     '#F59E0B',
  mapZoneAlertFill: 'rgba(245,158,11,0.15)',

  // ── Bordes ──
  borderDefault:    'rgba(124,255,60,0.15)',
  borderAccent:     'rgba(124,255,60,0.50)',
  borderDanger:     'rgba(239,68,68,0.50)',
  borderWarning:    'rgba(245,158,11,0.40)',
} as const;

export const Gradients = {
  background: 'linear-gradient(180deg, #1F2A5A 0%, #2B2F6E 100%)',
  accent:     'linear-gradient(135deg, #7CFF3C 0%, #33E1A1 50%, #2AB3FF 100%)',
  accentHover:'linear-gradient(135deg, #8FFF55 0%, #44F2B2 50%, #3BC4FF 100%)',
  surface:    'linear-gradient(135deg, rgba(37,45,107,0.9), rgba(46,53,120,0.9))',
  danger:     'linear-gradient(135deg, #EF4444, #DC2626)',
} as const;
```

### Tipografía

```typescript
// src/design-system/tokens/typography.ts
// Google Fonts — agregar en index.html:
// Exo 2 (weights: 400,500,600,700,800)
// DM Sans (weights: 400,500,600)
// JetBrains Mono (weights: 400,500)

export const Typography = {
  fontDisplay: "'Exo 2', sans-serif",       // Títulos, headers, nombres
  fontBody:    "'DM Sans', sans-serif",      // Body text, labels, botones
  fontMono:    "'JetBrains Mono', monospace",// Coordenadas, códigos, timestamps, datos numéricos

  size: {
    xs:   '0.75rem',    // 12px — timestamps, badges
    sm:   '0.875rem',   // 14px — labels, captions
    base: '1rem',       // 16px — body
    md:   '1.125rem',   // 18px — subtítulos
    lg:   '1.25rem',    // 20px — títulos sección
    xl:   '1.5rem',     // 24px — h3
    '2xl':'1.875rem',   // 30px — h2
    '3xl':'2.25rem',    // 36px — h1
    '4xl':'3rem',       // 48px — hero / display
  },

  weight: { normal:400, medium:500, semibold:600, bold:700, extrabold:800 }
} as const;
```

### Espaciado, Bordes y Sombras

```typescript
export const Spacing = {
  xs:'0.25rem', sm:'0.5rem', md:'1rem',
  lg:'1.5rem',  xl:'2rem',   '2xl':'3rem', '3xl':'4rem'
} as const;

export const Radius = {
  sm:'0.375rem', md:'0.75rem', lg:'1rem', xl:'1.5rem', full:'9999px'
} as const;

export const Shadows = {
  card:     '0 4px 24px rgba(0,0,0,0.4)',
  glowGreen:'0 0 20px rgba(124,255,60,0.25)',
  glowBlue: '0 0 20px rgba(42,179,255,0.25)',
  danger:   '0 0 20px rgba(239,68,68,0.30)',
} as const;
```

---

## 👥 SISTEMA DE ROLES

| Rol | Código | Descripción | Acceso |
|-----|--------|-------------|--------|
| **Rusertech Admin** | `rusertech_admin` | Equipo interno Rusertech | Total. Gestiona tenants, configs globales, puede entrar a cualquier cuenta |
| **Account Owner** | `account_owner` | Dueño / Gerente del cliente | Todo dentro de su empresa: usuarios, billing, configuraciones, alertas, viajes |
| **Manager** | `manager` | Gerente operativo del cliente | Configura eventos, reglas, alertas, vehículos. No gestiona usuarios ni billing |
| **Operator** | `operator` | Operador de monitoreo Rusertech | Monitorea mapa, declara viajes, reconoce alertas. Sin acceso a configuraciones |
| **External Client** | `external_client` | Usuario externo del cliente | **Autónomo:** carga y administra sus propios viajes, configura sus propias alertas y reglas. No ve configuraciones internas de Rusertech ni del tenant padre |
| **External Viewer** | `external_viewer` | Visualizador externo | Solo lectura: mapa y viajes que le fueron asignados. Sin modificar nada |

**Regla clave del `external_client`:** Rusertech Admin y Account Owner pueden entrar y configurar
para él si se lo piden. Pero el External Client no depende de nadie para operar sus viajes
y sus configuraciones de alertas propias.

---

## 📡 PAYLOAD DEL HUB — CONTRATO DE INGESTA

Este es el schema exacto que llega desde los prestadores GPS.
Todos los campos son `string | null` salvo Latitude y Longitude.
El parsing y casting a tipos correctos ocurre en el TelemetryIngestion service.

```typescript
// Payload RAW que envía el HUB (respetar exactamente)
interface HubRawPayload {
  Asset:        string;           // ID del dispositivo en el HUB — mapea a vehicle
  Latitude:     number;           // Único número real garantizado
  Longitude:    number;           // Único número real garantizado
  Speed:        string | null;    // km/h como string — parsear a number
  Code:         string | null;    // Código de evento del prestador (ej: "01", "EN", "IGN")
                                  // Se interpreta via diccionario del prestador
  Date:         string | null;    // ISO 8601 con timezone (ej: "2022-09-19T11:43:47-05:00")
  Course:       string | null;    // Heading como string — parsear a number (0-359)
  Ignition:     string | null;    // "0" o "1" — parsear a boolean
  Altitude:     string | null;    // Metros como string — parsear a number
  Odometer:     string | null;    // Km como string — solo registro, alerta configurable
  Battery:      string | null;    // Porcentaje como string — solo registro, alerta configurable
  Temperature:  string | null;    // °C como string — parsear a number. VIENE DEL SENSOR del vehículo
  Humidity:     string | null;    // % como string — parsear a number. VIENE DEL SENSOR
  Direction:    string | null;    // Ej: "N", "NE", "300" — descriptivo del heading
  SerialNumber: string | null;    // Número de serie del dispositivo GPS
  // Campos que recibimos pero NO usamos en lógica:
  Shipment:     string | null;    // Ignorar — solo raw_payload
  SourceTag:    string | null;    // Ignorar — solo raw_payload
  Alert:        string | null;    // Campo legacy. Ignorar — solo raw_payload
}

// NOTA CRÍTICA SOBRE User_avl:
// User_avl es el identificador de la cuenta AVL que inyecta los datos.
// Es OBLIGATORIO — sin él no hay ingesta válida (el HUB no acepta datos sin autenticación).
// En Rusertech, User_avl es la ENTIDAD CENTRAL de configuración:
//   - Tiene su propio diccionario de eventos (Code → evento estándar)
//   - Tiene las credenciales/URLs del sistema del prestador (repositorio de acceso)
//   - Los vehículos están asociados a un User_avl específico
// El campo se guarda en telemetry.avl_user_id (FK) Y en raw_payload.

// Payload NORMALIZADO interno después del parsing
interface TelemetryNormalized {
  vehicleId:      string;    // UUID interno — resuelto desde Asset + avlUserId
  avlUserId:      string;    // UUID interno del User_avl — SIEMPRE presente
  providerId:     string;    // UUID del prestador (padre del avl_user)
  timestamp:      Date;      // Parseado desde Date con timezone correcto
  latitude:       number;
  longitude:      number;
  speedKmh:       number | null;
  headingDegrees: number | null;  // Desde Course
  ignition:       boolean | null;
  altitudeMeters: number | null;
  odometerKm:     number | null;
  batteryPercent: number | null;
  temperatureC:   number | null;  // Del sensor del vehículo — no calculado
  humidityPct:    number | null;  // Del sensor del vehículo — no calculado
  directionLabel: string | null;
  providerCode:   string | null;  // Code original del prestador
  eventCode:      string | null;  // Code interpretado via diccionario del avl_user
  rawPayload:     object;         // Payload completo original sin modificar
}
```

### Diccionario de Códigos de Prestadores

```
Cada prestador GPS tiene sus propios códigos de eventos (field `Code`).
Rusertech mantiene un diccionario por prestador que traduce código → evento estándar.

Ejemplos:
  Prestador A: "01" → "ignition_on", "02" → "ignition_off", "03" → "speed_exceeded"
  Prestador B: "IGN" → "ignition_on", "SOS" → "sos_alert", "GEO" → "geofence_event"

El sistema NO conoce los códigos de antemano. El operador/admin los carga
en la UI de configuración de prestadores. Si un código no está en el diccionario,
se guarda el evento como "unknown_code:{code}" y se muestra en el log sin alarma.
```

---

## 🏗️ ARQUITECTURA TÉCNICA

```
┌──────────────────────────────────────────────────────────┐
│              HUB EXTERNO (Prestadores GPS)               │
│  Envía payload HubRawPayload por HTTPS cada N segundos   │
└────────────────────────┬─────────────────────────────────┘
                         │ POST /telemetry/ingest
                         │ Header: X-Hub-Api-Key
┌────────────────────────▼─────────────────────────────────┐
│            NESTJS — TelemetryIngestion Module            │
│  · Validación estructural del payload                    │
│  · Resolución Asset → vehicleId (Redis cache)            │
│  · Deduplicación (Redis)                                 │
│  · Parseo y normalización de campos string→tipo          │
│  · Interpretación Code via diccionario de prestador      │
│  · OUTBOX: INSERT telemetry + INSERT outbox (1 tx)       │
│  · UPDATE Redis: última posición del vehículo            │
└────────────────────────┬─────────────────────────────────┘
                         │ BullMQ Queue: telemetry.raw
┌────────────────────────▼─────────────────────────────────┐
│            NESTJS — EventEngine Module                   │
│  · Evalúa reglas configuradas (por tenant/vehículo/      │
│    operación/viaje) contra cada punto de telemetría      │
│  · Detecta: velocidad, geocercas, temperatura,           │
│    humedad, batería, señal perdida, desvío de ruta,      │
│    parada no autorizada, ignición, eventos del Code      │
│  · Publica alertas a BullMQ: events.triggered            │
│  · Calcula huella de carbono al cierre de viaje          │
│    (Climatiq API — activable/desactivable por switch)    │
└──────────┬─────────────────────────┬─────────────────────┘
           │                         │
           ▼                         ▼
┌──────────────────┐     ┌───────────────────────────┐
│  Notifications   │     │  SignalR / Socket.io Hub   │
│  Module          │     │  Canal: tenant/{id}         │
│  Email/Push/     │     │  Canal: trip/{id}           │
│  Webhook         │     │  Canal: vehicle/{id}        │
│  (Polly retry)   │     │  Backpressure: batch 500ms  │
└──────────────────┘     └─────────────┬─────────────┘
                                       │ WebSocket
┌──────────────────────────────────────▼─────────────┐
│                 REACT FRONTEND                      │
│  MapLibre GL JS 4D · Zustand · React Query            │
│  Herramientas de dibujo · Switches de alertas       │
└─────────────────────────────────────────────────────┘

PERSISTENCIA:
  PostgreSQL (Supabase) + PostGIS [+ TimescaleDB opcional]
    → Datos de negocio + telemetría histórica + geoespacial
  Redis (Upstash)
    → Última posición · Cache de vehículos · Deduplicación · BullMQ
```

### Stack Tecnológico Definitivo

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Runtime | Node.js 20 LTS | — |
| Framework | NestJS 10 | Modular, DI nativo, CQRS incluido |
| Lenguaje | TypeScript 5 (strict) | Full-stack uniforme |
| ORM | Prisma 5 | Migrations, tipos auto-generados |
| DB Principal | PostgreSQL 16 + PostGIS | En Supabase. TimescaleDB opcional via USE_TIMESCALEDB=true (Regla 45) |
| Cache + Queues | Redis 7 | En Upstash |
| Message Queue | BullMQ | Sobre Redis. Sin broker extra |
| Real-time | Socket.io (NestJS Gateway) | Por tenant y por viaje |
| Autenticación | JWT + Refresh Tokens | @nestjs/jwt + passport |
| Validación | class-validator + class-transformer | DTOs tipados |
| Resiliencia | Polly via cockatiel (Node) | Circuit breaker + retry |
| Carbon API | Climatiq | Toggle on/off desde UI |
| Logging | Pino | Más rápido que Winston |
| Observabilidad | OpenTelemetry + Prometheus + Grafana | — |
| Tests | Jest + Supertest | Unit + Integration |
| Frontend | React 18 + TypeScript | — |
| Bundler | Vite 5 | — |
| CSS | TailwindCSS 3 | Tokens del Design System |
| Estado | Zustand 4 | — |
| Data fetching | TanStack Query 5 | — |
| Mapas | MapLibre GL JS 4 + OpenFreeMap | Sin API key, sin costo, MIT |
| Tiles | tiles.openfreemap.org/styles/bright | OpenStreetMap data |
| Dibujo en mapa | @mapbox/mapbox-gl-draw (compatible con MapLibre) | — |
| Charts | Apache ECharts | Paleta del Design System |
| Excel | exceljs | Export xlsx sin licencia EPPlus |
| WhatsApp | Twilio / Meta Business API | Via INotificationChannel |
| Contenedores | Docker + Docker Compose | — |
| Reverse proxy | Nginx | HTTPS + WebSocket |
| SSL | Let's Encrypt + Certbot | — |

---

## 🗄️ MODELO DE BASE DE DATOS COMPLETO

```sql
-- ═══════════════════════════════════════
-- EXTENSIONES (ejecutar primero en Supabase)
-- ═══════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
-- NOTA: timescaledb NO se activa aquí. Se llama únicamente dentro de
-- prisma/migrations/001_telemetry_hypertable.sql cuando USE_TIMESCALEDB=true.

-- ═══════════════════════════════════════
-- MULTI-TENANT
-- ═══════════════════════════════════════

CREATE TABLE tenants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(200) NOT NULL,
  slug           VARCHAR(100) UNIQUE NOT NULL,
  plan           VARCHAR(50)  NOT NULL DEFAULT 'starter',
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  settings_json  JSONB        NOT NULL DEFAULT '{}',
  -- settings incluye: timezone, currency, logo_url, smtp_config, fcm_token
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(50)  NOT NULL UNIQUE,
  -- 'rusertech_admin'|'account_owner'|'manager'|'operator'|'external_client'|'external_viewer'
  name           VARCHAR(100) NOT NULL,
  is_system_role BOOLEAN      NOT NULL DEFAULT TRUE,
  permissions    TEXT[]       NOT NULL DEFAULT '{}'
  -- Array de permisos: 'trips:create', 'alerts:configure', 'vehicles:block', etc.
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id),
  email           VARCHAR(254) NOT NULL UNIQUE,
  password_hash   TEXT         NOT NULL,
  full_name       VARCHAR(200),
  role_code       VARCHAR(50)  NOT NULL REFERENCES roles(code),
  parent_user_id  UUID         REFERENCES users(id), -- Para external_client/viewer bajo un account
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- USER_AVL — ENTIDAD CENTRAL DE CONFIGURACIÓN
-- 
-- Jerarquía:
--   Tenant
--     └── AvlUser  ← UNIDAD CENTRAL
--           ├── Credenciales del prestador (repositorio de acceso, no usado en lógica)
--           ├── Diccionario de eventos PROPIO (Code → evento estándar)
--           └── Vehículos asociados (se resuelven por Asset + avl_user_id)
--
-- User_avl es OBLIGATORIO en cada payload del HUB.
-- Sin User_avl autenticado el HUB no acepta la inyección de datos.
-- Es la primera clave de resolución en la ingesta de telemetría.
-- ═══════════════════════════════════════

CREATE TABLE avl_users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id),
  user_avl_code       VARCHAR(100) NOT NULL,  -- El valor exacto del campo User_avl del HUB
  name                VARCHAR(200) NOT NULL,  -- Nombre descriptivo para la UI
  description         TEXT,

  -- Credenciales del prestador — REPOSITORIO DE ACCESO
  -- Solo para consulta manual ante caídas. No se usan en lógica automática.
  -- Se guardan encriptadas (AES-256 a nivel aplicación antes de persistir)
  provider_name       VARCHAR(200),           -- Nombre del prestador GPS
  provider_platform_url VARCHAR(500),         -- URL del panel del prestador
  provider_username   TEXT,                   -- Usuario (encriptado)
  provider_password   TEXT,                   -- Contraseña (encriptada)
  provider_api_url    VARCHAR(500),           -- URL de API del prestador si tiene
  provider_api_key    TEXT,                   -- API Key del prestador (encriptada)
  provider_notes      TEXT,                   -- Notas adicionales de acceso

  -- Control de ingesta
  api_key             VARCHAR(200) UNIQUE NOT NULL, -- API Key que usa este avl_user para autenticarse en el HUB
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,  -- SWITCH: activar/desactivar ingesta
  last_data_at        TIMESTAMPTZ,            -- Última vez que llegó un dato de este avl_user

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, user_avl_code)
);

-- Diccionario de eventos POR avl_user
-- Cada avl_user tiene sus propios códigos (no comparte con otros avl_users)
CREATE TABLE avl_event_dictionary (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avl_user_id     UUID         NOT NULL REFERENCES avl_users(id) ON DELETE CASCADE,
  raw_code        VARCHAR(50)  NOT NULL,   -- Code exacto que manda el dispositivo (ej: "01", "IGN", "SOS")
  event_type      VARCHAR(100) NOT NULL,   -- Evento estándar Rusertech (ej: "ignition_on", "sos_alert")
  description     VARCHAR(300),            -- Descripción legible para el operador
  triggers_alert  BOOLEAN      NOT NULL DEFAULT FALSE,  -- ¿Este código debe generar alerta automática?
  severity        VARCHAR(20)  NOT NULL DEFAULT 'info', -- 'info'|'warning'|'critical'
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,   -- SWITCH individual por código
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(avl_user_id, raw_code)
);

-- ═══════════════════════════════════════
-- FLOTA
-- ═══════════════════════════════════════

CREATE TABLE vehicles (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                 UUID         NOT NULL REFERENCES tenants(id),
  plate                     VARCHAR(20)  NOT NULL,
  alias                     VARCHAR(100),              -- Nombre amigable (ej: "Unidad 05")
  brand                     VARCHAR(100),
  model                     VARCHAR(200),
  year                      SMALLINT,
  vehicle_type              VARCHAR(50)  NOT NULL DEFAULT 'truck',
  -- 'truck'|'van'|'motorcycle'|'refrigerated'|'tanker'|'car'|'other'
  fuel_type                 VARCHAR(30)  NOT NULL DEFAULT 'diesel',
  -- 'diesel'|'gasoline'|'electric'|'hybrid' — Para cálculo CO2
  fuel_efficiency_lper100km DECIMAL(6,2),              -- Litros/100km para cálculo CO2
  hub_asset_id              VARCHAR(100),              -- Campo `Asset` del HUB que identifica este vehículo
  avl_user_id               UUID         REFERENCES avl_users(id),  -- User_avl al que pertenece este vehículo
  -- IMPORTANTE: la resolución en ingesta usa AMBOS: Asset + avl_user_id
  -- Dos avl_users distintos pueden tener el mismo Asset ID sin conflicto
  is_blocked                BOOLEAN      NOT NULL DEFAULT FALSE, -- Switch: bloquear ingesta de datos
  block_reason              TEXT,
  metadata_json             JSONB        NOT NULL DEFAULT '{}',
  status                    VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, plate)
);

CREATE TABLE drivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id),
  full_name       VARCHAR(200) NOT NULL,
  document        VARCHAR(50),
  document_type   VARCHAR(20)  DEFAULT 'dni',
  phone           VARCHAR(30),
  license_number  VARCHAR(50),
  license_expiry  DATE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE operations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id),
  name        VARCHAR(200) NOT NULL,
  code        VARCHAR(50),
  description TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
);

-- ═══════════════════════════════════════
-- TELEMETRÍA — ESTRATEGIA DUAL (Regla 45, v3.9)
-- Controlada por variable de entorno USE_TIMESCALEDB (default: false).
--
-- ▶ SECCIÓN A — USE_TIMESCALEDB=false (DEFAULT)
--   Archivo: prisma/migrations/001_telemetry_partitioned.sql
--   Usa PARTITION BY RANGE nativo de PostgreSQL.
--   Compatible con Supabase Free y cualquier PostgreSQL estándar.
--   Sin dependencias de extensiones de pago.
--
-- ▶ SECCIÓN B — USE_TIMESCALEDB=true (OPCIONAL)
--   Archivo: prisma/migrations/001_telemetry_hypertable.sql
--   Usa TimescaleDB create_hypertable().
--   Requiere Supabase Pro o instancia propia con TimescaleDB instalado.
--
-- NUNCA ejecutar prisma migrate dev para alterar esta tabla.
-- El modelo Prisma usa @@map("telemetry") solo para tipos — la estructura
-- real la gestiona el SQL manual de particiones/hypertable.
--
-- El INSERT es transparente en ambos modos:
--   prisma.telemetry.create({ data: {...} }) funciona igual en A y en B.
--   PostgreSQL redirige el INSERT a la partición correcta automáticamente.
-- ═══════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────┐
-- │ SECCIÓN A — PostgreSQL nativo (USE_TIMESCALEDB=false)       │
-- │ Ejecutar: psql $DB_URL -f 001_telemetry_partitioned.sql     │
-- └─────────────────────────────────────────────────────────────┘
--
-- ARCHIVO: prisma/migrations/001_telemetry_partitioned.sql
-- ─────────────────────────────────────────────────────────────────
-- CREATE TABLE telemetry (
--   id               UUID        NOT NULL DEFAULT uuid_generate_v4(),
--   tenant_id        UUID        NOT NULL,
--   vehicle_id       UUID        NOT NULL,
--   avl_user_id      UUID        NOT NULL,
--   timestamp        TIMESTAMPTZ NOT NULL,
--   latitude         DECIMAL(10,7) NOT NULL,
--   longitude        DECIMAL(10,7) NOT NULL,
--   location         GEOGRAPHY(POINT, 4326),
--   speed_kmh        DECIMAL(6,2),
--   heading_degrees  SMALLINT,
--   ignition         BOOLEAN,
--   altitude_meters  DECIMAL(8,2),
--   odometer_km      DECIMAL(10,2),
--   battery_pct      DECIMAL(5,2),
--   temperature_c    DECIMAL(6,2),
--   humidity_pct     DECIMAL(5,2),
--   direction_label  VARCHAR(10),
--   provider_code    VARCHAR(50),
--   event_type       VARCHAR(100),
--   is_duplicate     BOOLEAN     NOT NULL DEFAULT FALSE,
--   raw_payload      JSONB       NOT NULL,
--   PRIMARY KEY (id, timestamp)
-- ) PARTITION BY RANGE (timestamp);
--
-- -- Particiones iniciales (crear 12 meses desde el año de arranque):
-- CREATE TABLE telemetry_2026_01 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- CREATE TABLE telemetry_2026_02 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- CREATE TABLE telemetry_2026_03 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- CREATE TABLE telemetry_2026_04 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- CREATE TABLE telemetry_2026_05 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- CREATE TABLE telemetry_2026_06 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- CREATE TABLE telemetry_2026_07 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- CREATE TABLE telemetry_2026_08 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- CREATE TABLE telemetry_2026_09 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
-- CREATE TABLE telemetry_2026_10 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
-- CREATE TABLE telemetry_2026_11 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
-- CREATE TABLE telemetry_2026_12 PARTITION OF telemetry
--   FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
--
-- -- Índices en tabla particionada (sintaxis correcta — incluir timestamp):
-- CREATE INDEX idx_telemetry_vehicle_time ON telemetry (vehicle_id, timestamp DESC);
-- CREATE INDEX idx_telemetry_tenant_time  ON telemetry (tenant_id,  timestamp DESC);
-- CREATE INDEX idx_telemetry_location     ON telemetry USING GIST (location, timestamp);
-- CREATE INDEX idx_telemetry_event        ON telemetry (event_type, timestamp DESC)
--   WHERE event_type IS NOT NULL;
-- ─────────────────────────────────────────────────────────────────
--
-- ARCHIVO: prisma/migrations/002_telemetry_partition_cron.sql
-- Ejecutar SIEMPRE después de 001_telemetry_partitioned.sql
-- Requiere pg_cron (disponible en Supabase Free)
-- ─────────────────────────────────────────────────────────────────
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- -- Job que corre el día 25 de cada mes a las 09:00 UTC
-- -- Crea la partición del mes siguiente antes de que lleguen los datos
-- SELECT cron.schedule(
--   'rusertech-create-telemetry-partition',
--   '0 9 25 * *',
--   $$
--     DO $body$
--     DECLARE
--       next_month  DATE := date_trunc('month', NOW() + INTERVAL '1 month');
--       tbl_name    TEXT := 'telemetry_' || to_char(next_month, 'YYYY_MM');
--       range_start TEXT := to_char(next_month, 'YYYY-MM-DD');
--       range_end   TEXT := to_char(
--                             next_month + INTERVAL '1 month', 'YYYY-MM-DD');
--     BEGIN
--       EXECUTE format(
--         'CREATE TABLE IF NOT EXISTS %I
--          PARTITION OF telemetry
--          FOR VALUES FROM (%L) TO (%L)',
--         tbl_name, range_start, range_end
--       );
--       RAISE NOTICE 'Partición % creada para rango % → %',
--         tbl_name, range_start, range_end;
--     END $body$;
--   $$
-- );
-- ─────────────────────────────────────────────────────────────────


-- ┌─────────────────────────────────────────────────────────────┐
-- │ SECCIÓN B — TimescaleDB (USE_TIMESCALEDB=true)              │
-- │ Ejecutar: psql $DB_URL -f 001_telemetry_hypertable.sql      │
-- └─────────────────────────────────────────────────────────────┘
--
-- ARCHIVO: prisma/migrations/001_telemetry_hypertable.sql
-- ─────────────────────────────────────────────────────────────────
-- CREATE EXTENSION IF NOT EXISTS timescaledb;
--
-- CREATE TABLE telemetry (
--   id               UUID        NOT NULL DEFAULT uuid_generate_v4(),
--   tenant_id        UUID        NOT NULL,
--   vehicle_id       UUID        NOT NULL,
--   avl_user_id      UUID        NOT NULL,
--   timestamp        TIMESTAMPTZ NOT NULL,
--   latitude         DECIMAL(10,7) NOT NULL,
--   longitude        DECIMAL(10,7) NOT NULL,
--   location         GEOGRAPHY(POINT, 4326),
--   speed_kmh        DECIMAL(6,2),
--   heading_degrees  SMALLINT,
--   ignition         BOOLEAN,
--   altitude_meters  DECIMAL(8,2),
--   odometer_km      DECIMAL(10,2),
--   battery_pct      DECIMAL(5,2),
--   temperature_c    DECIMAL(6,2),
--   humidity_pct     DECIMAL(5,2),
--   direction_label  VARCHAR(10),
--   provider_code    VARCHAR(50),
--   event_type       VARCHAR(100),
--   is_duplicate     BOOLEAN     NOT NULL DEFAULT FALSE,
--   raw_payload      JSONB       NOT NULL,
--   PRIMARY KEY (id, timestamp)
-- );
--
-- SELECT create_hypertable('telemetry', 'timestamp');
--
-- CREATE INDEX idx_telemetry_vehicle_time ON telemetry (vehicle_id, timestamp DESC);
-- CREATE INDEX idx_telemetry_tenant_time  ON telemetry (tenant_id,  timestamp DESC);
-- CREATE INDEX idx_telemetry_location     ON telemetry USING GIST (location);
-- CREATE INDEX idx_telemetry_event        ON telemetry (event_type, timestamp DESC)
--   WHERE event_type IS NOT NULL;
-- ─────────────────────────────────────────────────────────────────

-- DEFINICIÓN CANÓNICA DE CAMPOS (referencia para schema.prisma):
-- La estructura de columnas es idéntica en ambas secciones.
-- Se presenta aquí como referencia formal para el modelo Prisma:

CREATE TABLE telemetry (
  id               UUID        NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL,
  vehicle_id       UUID        NOT NULL,
  avl_user_id      UUID        NOT NULL,  -- SIEMPRE presente. FK a avl_users.
  -- Trazabilidad completa: sabemos SIEMPRE qué User_avl envió cada dato.
  timestamp        TIMESTAMPTZ NOT NULL,   -- Clave de particionamiento en ambos modos
  latitude         DECIMAL(10,7) NOT NULL,
  longitude        DECIMAL(10,7) NOT NULL,
  location         GEOGRAPHY(POINT, 4326), -- Calculado en insert: ST_MakePoint(lng,lat)
  speed_kmh        DECIMAL(6,2),
  heading_degrees  SMALLINT,
  ignition         BOOLEAN,
  altitude_meters  DECIMAL(8,2),
  odometer_km      DECIMAL(10,2),
  battery_pct      DECIMAL(5,2),
  temperature_c    DECIMAL(6,2),           -- Del sensor del vehículo. NULL si no tiene sensor.
  humidity_pct     DECIMAL(5,2),           -- Del sensor del vehículo. NULL si no tiene sensor.
  direction_label  VARCHAR(10),
  provider_code    VARCHAR(50),            -- Code original del HUB
  event_type       VARCHAR(100),           -- Code interpretado via diccionario
  is_duplicate     BOOLEAN     NOT NULL DEFAULT FALSE,
  raw_payload      JSONB       NOT NULL,   -- Payload completo original sin modificar
  PRIMARY KEY (id, timestamp)
);
-- NOTA: Esta CREATE TABLE es solo referencia de campos para el IDE/Prisma.
-- En producción ejecutar el archivo SQL correspondiente al modo elegido.
-- VER INSTRUCCIONES EN BLOQUE 0 DEL MASTER PROMPT.

-- ═══════════════════════════════════════
-- GEOCERCAS Y ZONAS ESPECIALES
-- ═══════════════════════════════════════

CREATE TABLE geofences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  zone_type       VARCHAR(30)  NOT NULL,
  -- 'geofence'|'route_corridor'|'danger_zone'|'alert_zone'|'restricted_zone'
  geometry        GEOGRAPHY    NOT NULL,
  -- PostGIS: POLYGON, MULTIPOLYGON, o buffer de POINT (círculo)
  geometry_type   VARCHAR(20)  NOT NULL,
  -- 'polygon'|'circle'|'corridor'
  center_lat      DECIMAL(10,7),        -- Para círculos
  center_lng      DECIMAL(10,7),        -- Para círculos
  radius_meters   INTEGER,              -- Para círculos
  color           VARCHAR(7)   NOT NULL DEFAULT '#2AB3FF',
  fill_opacity    DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  country_code    CHAR(2)      NOT NULL DEFAULT 'AR', -- ISO 3166-1 alpha-2 (Regla 32)
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_geofences_geometry ON geofences USING GIST (geometry);
CREATE INDEX idx_geofences_tenant   ON geofences (tenant_id, zone_type);
CREATE INDEX idx_geofences_country  ON geofences (tenant_id, country_code);

-- ═══════════════════════════════════════
-- VIAJES
-- ═══════════════════════════════════════

CREATE TABLE trips (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id),
  created_by_user_id      UUID         NOT NULL REFERENCES users(id),
  -- Si lo creó un external_client, queda registrado aquí
  vehicle_id              UUID         NOT NULL REFERENCES vehicles(id),
  driver_id               UUID         REFERENCES drivers(id),
  operation_id            UUID         REFERENCES operations(id),
  origin_name             VARCHAR(300),
  origin_address          VARCHAR(500),
  origin_lat              DECIMAL(10,7),
  origin_lng              DECIMAL(10,7),
  destination_name        VARCHAR(300),
  destination_address     VARCHAR(500),
  destination_lat         DECIMAL(10,7),
  destination_lng         DECIMAL(10,7),
  planned_start           TIMESTAMPTZ  NOT NULL,
  planned_end             TIMESTAMPTZ  NOT NULL,
  actual_start            TIMESTAMPTZ,
  actual_end              TIMESTAMPTZ,
  planned_route_geojson   JSONB,           -- LineString dibujado por el usuario en el mapa
  corridor_meters         INTEGER      NOT NULL DEFAULT 500,
  criticality             VARCHAR(20)  NOT NULL DEFAULT 'normal',
  -- 'low'|'normal'|'high'|'critical'
  reinforced_monitoring   BOOLEAN      NOT NULL DEFAULT FALSE,
  status                  VARCHAR(30)  NOT NULL DEFAULT 'draft',
  -- 'draft'|'scheduled'|'in_progress'|'deviated'|'at_risk'|
  -- 'authorized_stop'|  ← parada autorizada (no genera alarma de parada)
  -- 'at_checkpoint'|    ← en zona de control (puede tener reglas especiales)
  -- 'completed'|'cancelled'
  cancel_reason           TEXT,
  notes                   TEXT,
  -- Cambios mid-trip: el sistema permite cambiar vehículo y conductor con viaje abierto
  -- Cada cambio queda en trip_command_history con previous_value y new_value
  vehicle_changes_count   SMALLINT     NOT NULL DEFAULT 0,  -- Cuántas veces cambió el vehículo
  driver_changes_count    SMALLINT     NOT NULL DEFAULT 0,  -- Cuántas veces cambió el conductor
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE trip_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID         NOT NULL REFERENCES trips(id),
  tenant_id     UUID         NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  severity      VARCHAR(20)  NOT NULL DEFAULT 'info',
  timestamp     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  location      GEOGRAPHY(POINT, 4326),
  metadata_json JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE trip_deviations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id                  UUID         NOT NULL REFERENCES trips(id),
  tenant_id                UUID         NOT NULL,
  deviation_meters         DECIMAL(10,2) NOT NULL,
  deviation_point          GEOGRAPHY(POINT, 4326),
  deviation_segment_geojson JSONB,   -- Segmento exacto para render en mapa
  timestamp                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- MOTOR DE EVENTOS CONFIGURABLE
-- Reglas configurables por tenant / vehículo / operación / viaje
-- con switch individual de activación
-- ═══════════════════════════════════════

CREATE TABLE event_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id),
  owner_user_id     UUID         REFERENCES users(id),
  -- Si lo creó un external_client, el rule solo aplica a sus viajes
  name              VARCHAR(200) NOT NULL,
  scope_type        VARCHAR(30)  NOT NULL,
  -- 'global_tenant'|'vehicle'|'operation'|'trip'
  scope_id          UUID,
  event_type        VARCHAR(100) NOT NULL,
  -- 'speed_exceeded'|'idle'|'geofence_enter'|'geofence_exit'|
  -- 'route_deviation'|'unauthorized_stop'|'signal_loss'|
  -- 'ignition_on'|'ignition_off'|
  -- 'temperature_out_of_range'|'temperature_spike'|
  -- 'humidity_out_of_range'|'humidity_spike'|
  -- 'battery_low'|'odometer_threshold'|
  -- 'provider_code_event'|'trip_delayed'
  threshold_min     DECIMAL(10,2),
  threshold_max     DECIMAL(10,2),
  duration_seconds  INTEGER      DEFAULT 0,
  spike_delta       DECIMAL(10,2),          -- Para eventos tipo "cambio brusco"
  severity          VARCHAR(20)  NOT NULL DEFAULT 'warning',
  -- 'info'|'warning'|'critical'
  action_type       VARCHAR(30)  NOT NULL DEFAULT 'none',
  -- 'none'|'email'|'push'|'whatsapp'|'webhook'|'ticket'|'all'
  -- 'all' incluye email + push + whatsapp + webhook si están configurados
  action_config     JSONB        NOT NULL DEFAULT '{}',
  -- {"email":"ops@empresa.com","webhook":"https://...","secret":"..."}
  geofence_id       UUID         REFERENCES geofences(id),
  provider_code_filter VARCHAR(50),         -- Solo para event_type='provider_code_event'
  -- ALARM GROUPING (Regla 26 — reduce fatiga sin perder información)
  -- Si el mismo tipo de alarma dispara N veces en corta distancia o tiempo:
  -- → event_logs: se registra CADA ocurrencia individual (historial completo)
  -- → notificaciones: se agrupa en UNA notificación con contador
  groupable_distance_meters INTEGER,
  -- NULL = no agrupar por distancia
  -- N    = si hay otra alerta del mismo tipo a menos de N metros → agrupar
  groupable_time_seconds    INTEGER,
  -- NULL = no agrupar por tiempo
  -- N    = si hay otra alerta del mismo tipo en menos de N segundos → agrupar
  -- Ejemplo configurado: "Exceso de velocidad x5 en 2 min" en lugar de 5 alertas
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE, -- SWITCH principal
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE event_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL,
  vehicle_id      UUID         NOT NULL REFERENCES vehicles(id),
  trip_id         UUID         REFERENCES trips(id),
  rule_id         UUID         REFERENCES event_rules(id),
  event_type      VARCHAR(100) NOT NULL,
  severity        VARCHAR(20)  NOT NULL,
  triggered_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  acknowledged_by UUID         REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  status          VARCHAR(30)  NOT NULL DEFAULT 'open',
  -- 'open'|'acknowledged'|'resolved'|'false_positive'
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  address         VARCHAR(500),  -- Dirección geocodificada (Nominatim/Photon (OSM — sin API key))
  provider_code   VARCHAR(50),
  -- Contexto enriquecido (null si no aplica):
  no_signal_zone_id UUID        REFERENCES no_signal_zones(id),
  -- Si este event_log es un signal_loss ocurrido dentro de una zona muerta conocida,
  -- se registra aquí para que el operador vea el contexto sin que se suprima la alerta.
  grouped_count   SMALLINT     NOT NULL DEFAULT 1,
  -- Si alarm grouping está activo y se agruparon N alertas en una notificación,
  -- este campo indica cuántas ocurrencias representa esta entrada notificada.
  -- event_logs siempre tiene los registros individuales — grouped_count solo aplica
  -- al registro que SE NOTIFICÓ (los demás tienen grouped_count=1, was_notified=false)
  metadata_json   JSONB        NOT NULL DEFAULT '{}'
);

-- ═══════════════════════════════════════
-- CONFIGURACIÓN DE SENSORES (Temperatura y Humedad)
-- Mismo tratamiento para ambos
-- ═══════════════════════════════════════

CREATE TABLE sensor_configs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id),
  sensor_type      VARCHAR(20)  NOT NULL,  -- 'temperature'|'humidity'
  scope_type       VARCHAR(30)  NOT NULL,  -- 'vehicle'|'operation'|'trip'
  scope_id         UUID         NOT NULL,
  value_min        DECIMAL(8,2) NOT NULL,
  value_max        DECIMAL(8,2) NOT NULL,
  tolerance        DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  duration_seconds INTEGER      NOT NULL DEFAULT 60,
  spike_delta      DECIMAL(6,2) NOT NULL DEFAULT 5.0,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,  -- SWITCH
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- HUELLA DE CARBONO (Cálculo INTERNO)
-- NO confundir con temperatura.
-- Calculado por EventEngine al cerrar viaje.
-- Fuente: km recorridos + velocidad promedio + tipo/modelo de vehículo.
-- Puede usar Climatiq API (configurable por switch).
-- ═══════════════════════════════════════

CREATE TABLE carbon_settings (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID         NOT NULL UNIQUE REFERENCES tenants(id),
  use_climatiq_api     BOOLEAN      NOT NULL DEFAULT FALSE,  -- SWITCH on/off
  climatiq_api_key     TEXT,
  default_method       VARCHAR(50)  NOT NULL DEFAULT 'formula',
  -- 'formula'|'climatiq'
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE carbon_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID         NOT NULL,
  vehicle_id         UUID         NOT NULL REFERENCES vehicles(id),
  trip_id            UUID         REFERENCES trips(id),
  period_start       TIMESTAMPTZ  NOT NULL,
  period_end         TIMESTAMPTZ  NOT NULL,
  distance_km        DECIMAL(10,2) NOT NULL,
  avg_speed_kmh      DECIMAL(8,2),
  fuel_liters        DECIMAL(10,3),
  co2_kg             DECIMAL(10,3) NOT NULL,
  calculation_method VARCHAR(50)  NOT NULL,  -- 'formula'|'climatiq'
  climatiq_response  JSONB,                  -- Respuesta completa de Climatiq si se usó
  calculated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- SAVED LOCATIONS (Ubicaciones)
-- Puntos de interés operativos reutilizables: depósitos, plantas,
-- clientes, terminales, puertos. Son los nodos del grafo de recorridos.
-- No confundir con geocercas (que son zonas de alerta).
-- Las Ubicaciones son ORÍGENES y DESTINOS de Recorridos.
-- ═══════════════════════════════════════

CREATE TABLE saved_locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,  -- Ej: "Planta Rosario", "Depósito Central", "Puerto Madero"
  address         VARCHAR(500),           -- Dirección legible (puede ser geocodificada o manual)
  latitude        DECIMAL(10,7) NOT NULL,
  longitude       DECIMAL(10,7) NOT NULL,
  geometry        GEOGRAPHY    NOT NULL,  -- ST_MakePoint para cálculos PostGIS
  radius_meters   INTEGER      NOT NULL DEFAULT 200, -- Radio de llegada (para ControlZone)
  location_type   VARCHAR(50)  NOT NULL DEFAULT 'generic',
  -- 'origin'|'destination'|'warehouse'|'plant'|'client'|'port'|'checkpoint'|'generic'
  country_code    CHAR(2)      NOT NULL DEFAULT 'AR',
  -- ISO 3166-1 alpha-2: 'AR'|'CL'|'UY'|'BR'|'PY'|'BO'|'PE'|'CO'|'MX'|...
  -- Permite agrupar, filtrar y exportar por país de operación (Regla 32)
  notes           TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_saved_locations_tenant   ON saved_locations (tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_saved_locations_geometry ON saved_locations USING GIST (geometry);
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- ROUTES (Recorridos)
-- Rutas pre-definidas y reutilizables, asignadas a un cliente/operación.
-- UN recorrido puede usarse en MUCHOS viajes.
-- Jerarquía: Tenant → Cliente (operation) → Recorridos → Viajes
-- Al crear un viaje se SELECCIONA un recorrido existente (o se dibuja uno nuevo).
-- ═══════════════════════════════════════

CREATE TABLE routes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id),
  operation_id          UUID         REFERENCES operations(id),
  -- NULL = recorrido genérico del tenant (no asignado a cliente específico)
  -- UUID = recorrido específico de este cliente/operación
  name                  VARCHAR(200) NOT NULL,  -- Ej: "Rosario → Córdoba vía Ruta 9"
  description           TEXT,
  origin_location_id    UUID         REFERENCES saved_locations(id),
  destination_location_id UUID       REFERENCES saved_locations(id),
  -- Geometría completa del recorrido dibujado (LineString)
  geometry              GEOGRAPHY    NOT NULL,
  distance_km           DECIMAL(10,2),          -- Calculado al guardar
  estimated_minutes     INTEGER,                -- Tiempo estimado de viaje
  corridor_meters       INTEGER      NOT NULL DEFAULT 500, -- Tolerancia de desvío
  country_code          CHAR(2)      NOT NULL DEFAULT 'AR',
  -- ISO 3166-1 alpha-2. País de operación principal del recorrido.
  -- Si cruza países: country_code del país de origen.
  -- Permite filtrar recorridos por país y export KML por país (Regla 32)
  -- Waypoints intermedios asignados (control zones del recorrido)
  waypoint_ids          UUID[]       NOT NULL DEFAULT '{}',
  -- Referencias a control_zones en orden de paso
  -- Metadata
  times_used            INTEGER      NOT NULL DEFAULT 0,  -- Cuántos viajes usaron este recorrido
  last_used_at          TIMESTAMPTZ,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,  -- SWITCH
  created_by            UUID         REFERENCES users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_routes_tenant    ON routes (tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_routes_operation ON routes (operation_id);
CREATE INDEX idx_routes_geometry  ON routes USING GIST (geometry);
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- TABLA PIVOTE — GEOCERCAS ↔ RECORRIDOS (Regla 40, v3.8)
-- Una geocerca se asigna libremente a N recorridos.
-- Un recorrido puede tener N geocercas asignadas.
-- La asignación es POR RECORRIDO, no global al tenant.
-- El motor de eventos (Bloque 5) evalúa SOLO las geocercas
-- asignadas al recorrido activo del vehículo.
-- Si una geocerca NO está en route_geofences para ese recorrido,
-- el evento de entrada/salida NO se dispara, aunque el vehículo
-- entre físicamente en la zona.
-- ═══════════════════════════════════════
CREATE TABLE route_geofences (
  route_id      UUID NOT NULL REFERENCES routes(id)    ON DELETE CASCADE,
  geofence_id   UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  -- Quién realizó la asignación y cuándo (para audit trail)
  assigned_by   UUID         REFERENCES users(id),
  assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (route_id, geofence_id)
);
CREATE INDEX idx_route_geofences_route    ON route_geofences (route_id);
CREATE INDEX idx_route_geofences_geofence ON route_geofences (geofence_id);
ALTER TABLE route_geofences ENABLE ROW LEVEL SECURITY;

-- Viajes ahora pueden referenciar un route pre-definido
ALTER TABLE trips ADD COLUMN route_id UUID REFERENCES routes(id);
-- NULL = ruta dibujada directamente en el viaje (sin recorrido guardado)
-- UUID = usa un recorrido pre-definido (plannedRouteGeoJson se copia desde routes.geometry)
-- Túneles, montañas, zonas sin cobertura celular conocidas.
-- PROPÓSITO DOBLE:
--   1. Pre-trip warning: al planificar una ruta, alertar si la cruza
--   2. Contexto de alerta: si signal_loss ocurre aquí, enriquecer la alerta
--      con "zona muerta conocida: [nombre]" — NO suprimir la alerta.
-- El operador SIEMPRE recibe la alerta signal_loss.
-- La zona solo agrega contexto para que no sea una sorpresa.
-- El vehículo puede recuperar señal dentro de la zona (antenas, cobertura parcial).
-- ═══════════════════════════════════════

CREATE TABLE no_signal_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         REFERENCES tenants(id),
  -- NULL = zona global del sistema (definida por Rusertech Admin para toda la plataforma)
  -- UUID = zona específica del tenant (ej: zona muerta conocida de su región operativa)
  name            VARCHAR(200) NOT NULL,  -- Ej: "Túnel Ruta 38 Km 45", "Sierra de Córdoba"
  description     TEXT,
  geometry        GEOGRAPHY    NOT NULL,  -- Polígono que delimita la zona
  geometry_type   VARCHAR(20)  NOT NULL DEFAULT 'polygon',
  -- Causa conocida de la falta de señal (informativo para el operador):
  signal_loss_reason VARCHAR(100),
  -- 'tunnel'|'mountain'|'no_coverage'|'interference'|'other'
  expected_loss_minutes INTEGER,  -- Duración esperada de pérdida (estimado)
  -- NULL = duración desconocida
  country_code    CHAR(2)      NOT NULL DEFAULT 'AR', -- ISO 3166-1 alpha-2 (Regla 32)
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_no_signal_zones_geometry ON no_signal_zones USING GIST (geometry);
CREATE INDEX idx_no_signal_zones_tenant   ON no_signal_zones (tenant_id) WHERE is_active = TRUE;

ALTER TABLE no_signal_zones ENABLE ROW LEVEL SECURITY;
-- El operador ajusta estos valores desde la UI sin necesidad de deploy.
-- Controla comportamientos globales y por tenant en runtime.
-- ═══════════════════════════════════════

CREATE TABLE parameter_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         REFERENCES tenants(id),
  -- NULL = configuración global del sistema (solo rusertech_admin puede editarla)
  -- UUID = configuración específica del tenant (sobreescribe la global)
  parameter_key   VARCHAR(100) NOT NULL,
  -- Ejemplos de claves:
  -- 'signal_loss_alert_minutes'       → minutos sin señal para disparar alerta (default: 15)
  -- 'default_corridor_meters'         → tolerancia de corredor por defecto (default: 500)
  -- 'chronic_alarm_reeval_minutes'    → ventana de re-evaluación de crónicas (default: 30)
  -- 'risk_elevated_score_threshold'   → score para nivel Elevated (default: 25)
  -- 'risk_high_score_threshold'       → score para nivel High (default: 50)
  -- 'risk_critical_score_threshold'   → score para nivel Critical (default: 75)
  -- 'risk_decay_rate_per_hour'        → puntos que se restan por hora si se tratan alertas (default: 10)
  -- 'trip_autostart_on_origin_exit'   → auto-iniciar viaje al salir de zona origen (default: false)
  -- 'geocoding_cache_hours'           → horas de cache para geocodificación inversa (default: 24)
  -- 'static_map_zoom_level'           → zoom del mapa estático en emails (default: 14)
  -- 'route_similarity_radius_meters'  → radio en metros para detectar recorridos similares (default: 500)
  parameter_value TEXT         NOT NULL,
  data_type       VARCHAR(20)  NOT NULL DEFAULT 'string',
  -- 'string'|'number'|'boolean'|'json'
  description     VARCHAR(500),
  is_editable_by_account_owner BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by      UUID         REFERENCES users(id),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, parameter_key)
);

-- ═══════════════════════════════════════
-- RISK LEVEL — Estado de riesgo dinámico del viaje
-- NO es la severidad de una alerta individual.
-- Es el nivel de riesgo ACUMULADO del viaje completo.
-- Calculado por scoring de múltiples factores.
-- Inspirado en SIMON RiskLevel — superado con scoring contextual.
-- ═══════════════════════════════════════

CREATE TABLE trip_risk_levels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID         NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  tenant_id         UUID         NOT NULL,
  risk_level        VARCHAR(20)  NOT NULL DEFAULT 'normal',
  -- 'normal'   → Score 0-24   🟢 Verde
  -- 'elevated' → Score 25-49  🟡 Amarillo
  -- 'high'     → Score 50-74  🟠 Naranja
  -- 'critical' → Score 75+    🔴 Rojo pulsante
  risk_score        INTEGER      NOT NULL DEFAULT 0,
  -- Score calculado sumando factores activos (ver tabla de factores abajo)
  active_factors    JSONB        NOT NULL DEFAULT '[]',
  -- Array de factores que contribuyen al score actual:
  -- [{ factor: 'signal_loss', points: 30, since: '2026-02-20T14:00:00Z' },
  --   { factor: 'route_deviation', points: 20, active_minutes: 15 }]
  previous_level    VARCHAR(20),
  level_changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notified_at       TIMESTAMPTZ,  -- Cuándo se notificó el cambio de nivel
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_risk_active_trip ON trip_risk_levels (trip_id);

CREATE TABLE trip_risk_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID         NOT NULL REFERENCES trips(id),
  tenant_id     UUID         NOT NULL,
  from_level    VARCHAR(20)  NOT NULL,
  to_level      VARCHAR(20)  NOT NULL,
  risk_score    INTEGER      NOT NULL,
  trigger_factor VARCHAR(100) NOT NULL, -- Qué factor causó el cambio
  changed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- CONTROL ZONES — Zonas que disparan transiciones de estado del viaje
-- Diferentes a geocercas de alerta. Son puntos operativos del viaje.
-- Tipos: origin (salida = inicio de viaje), destination (llegada = fin),
--        waypoint (punto intermedio obligatorio), checkpoint (control de ruta)
-- ═══════════════════════════════════════

CREATE TABLE control_zones (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  zone_type             VARCHAR(30)  NOT NULL,
  -- 'origin'       → al SALIR de aquí, el viaje puede auto-iniciarse
  -- 'destination'  → al ENTRAR aquí, el viaje puede auto-completarse
  -- 'waypoint'     → punto intermedio obligatorio. Genera evento si no se pasa por aquí
  -- 'checkpoint'   → control de paso. Genera evento al entrar. No es obligatorio.
  geometry              GEOGRAPHY    NOT NULL,
  radius_meters         INTEGER      NOT NULL DEFAULT 200,

  -- Comportamiento al triggerear (configurable por tenant via ParameterSettings
  -- y sobreescribible por viaje individual)
  auto_transition       BOOLEAN      NOT NULL DEFAULT FALSE,
  -- FALSE → notifica al operador para confirmación manual
  -- TRUE  → ejecuta la transición de estado automáticamente
  transition_target_status VARCHAR(30),
  -- Para origin: 'in_progress' | Para destination: 'completed'
  -- Para waypoint: null (no cambia status, solo registra el paso)

  notify_on_enter       BOOLEAN      NOT NULL DEFAULT TRUE,
  notify_on_exit        BOOLEAN      NOT NULL DEFAULT FALSE,
  notify_if_skipped     BOOLEAN      NOT NULL DEFAULT TRUE, -- Para waypoints obligatorios
  country_code          CHAR(2)      NOT NULL DEFAULT 'AR', -- ISO 3166-1 alpha-2 (Regla 32)
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by            UUID         REFERENCES users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_control_zones_geometry ON control_zones USING GIST (geometry);
CREATE INDEX idx_control_zones_tenant   ON control_zones (tenant_id, zone_type);

-- Asociación de control_zones a viajes específicos
-- (un viaje puede tener su propia zona de origen/destino diferente a las globales)
CREATE TABLE trip_control_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  control_zone_id UUID NOT NULL REFERENCES control_zones(id),
  sequence_order  SMALLINT NOT NULL DEFAULT 0, -- Para waypoints ordenados
  was_triggered   BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at    TIMESTAMPTZ,
  UNIQUE(trip_id, control_zone_id)
);
-- Registro cronológico de TODAS las intervenciones sobre un viaje.
-- No solo eventos GPS — también cambios manuales de operadores.
-- ═══════════════════════════════════════

CREATE TABLE trip_command_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id         UUID         NOT NULL REFERENCES trips(id),
  tenant_id       UUID         NOT NULL,
  command_type    VARCHAR(100) NOT NULL,
  -- 'trip_created'|'trip_scheduled'|'trip_started'|'trip_completed'|'trip_cancelled'
  -- 'driver_changed'|'vehicle_changed'|'route_updated'|'status_changed'
  -- 'deviation_acknowledged'|'alert_acknowledged'|'monitoring_toggled'|'manual_note'
  executed_by     UUID         REFERENCES users(id),  -- NULL si fue automático por el sistema
  executed_by_role VARCHAR(50),
  is_automatic    BOOLEAN      NOT NULL DEFAULT FALSE,  -- TRUE = acción del sistema, FALSE = acción humana
  previous_value  JSONB,       -- Estado anterior (antes del cambio)
  new_value       JSONB,       -- Estado nuevo (después del cambio)
  notes           TEXT,        -- Nota libre del operador si aplica
  timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trip_history_trip ON trip_command_history (trip_id, timestamp DESC);

-- ═══════════════════════════════════════
-- POSITION FORWARDING (HubDistributor)
-- Reenvío continuo de posiciones GPS a sistemas externos del cliente.
-- DIFERENTE a los webhooks de alertas:
--   - Webhooks de alertas → evento puntual cuando se dispara una alarma
--   - Position Forwarding → stream continuo de posiciones en tiempo real
-- Caso de uso: cliente enterprise que quiere embeber el tracking
-- en su propio sistema (TMS, ERP, portal propio).
-- ═══════════════════════════════════════

CREATE TABLE position_forwarders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id),
  name              VARCHAR(200) NOT NULL,  -- Nombre descriptivo (ej: "TMS Externo - Producción")
  description       TEXT,

  -- Destino del forwarding
  target_url        VARCHAR(500) NOT NULL,  -- URL que recibirá las posiciones
  http_method       VARCHAR(10)  NOT NULL DEFAULT 'POST', -- 'POST'|'PUT'
  secret_key        TEXT,                  -- Para firmar payload (HMAC-SHA256)
  custom_headers    JSONB        NOT NULL DEFAULT '{}',
  -- Ej: {"X-Api-Key": "...", "X-Client-Id": "..."}

  -- Filtros — qué posiciones reenviar
  vehicle_filter    UUID[],      -- NULL = todos los vehículos del tenant
  -- Si tiene valores: solo reenviar posiciones de estos vehicleIds
  min_speed_filter  INTEGER,     -- NULL = todas. Si tiene valor: solo enviar si speed >= X km/h
  only_with_trip    BOOLEAN      NOT NULL DEFAULT FALSE,
  -- TRUE = solo reenviar posiciones de vehículos con viaje activo

  -- Formato del payload
  payload_format    VARCHAR(30)  NOT NULL DEFAULT 'rusertech',
  -- 'rusertech' → formato estándar Rusertech (JSON con todos los campos normalizados)
  -- 'custom'    → template JSON configurable por el cliente

  payload_template  JSONB,
  -- Si payload_format='custom', template con variables:
  -- {"lat": "{{latitude}}", "lng": "{{longitude}}", "vel": "{{speedKmh}}",
  --  "placa": "{{plate}}", "ts": "{{timestamp}}", "viaje": "{{tripId}}"}

  -- Control de envío
  batch_size        SMALLINT     NOT NULL DEFAULT 1,
  -- 1 = enviar cada posición individualmente
  -- N = acumular N posiciones y enviar como array (reduce llamadas HTTP)
  batch_interval_ms INTEGER      NOT NULL DEFAULT 0,
  -- 0 = enviar en cuanto llega (solo si batch_size=1)
  -- N = enviar batch cada N milisegundos

  -- Estado y métricas
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,  -- SWITCH
  last_forwarded_at TIMESTAMPTZ,
  total_sent        BIGINT       NOT NULL DEFAULT 0,
  total_failed      BIGINT       NOT NULL DEFAULT 0,
  last_error        TEXT,
  last_error_at     TIMESTAMPTZ,

  -- Circuit breaker (cockatiel)
  circuit_open      BOOLEAN      NOT NULL DEFAULT FALSE,
  circuit_opened_at TIMESTAMPTZ,
  -- Si el destino falla 5 veces en 60s: circuit abierto, parar envíos
  -- Reintenta automáticamente cada 5 minutos

  created_by        UUID         REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_forwarders_tenant ON position_forwarders (tenant_id) WHERE is_active = TRUE;

ALTER TABLE position_forwarders ENABLE ROW LEVEL SECURITY;
-- Trazabilidad completa de CUALQUIER cambio en CUALQUIER entidad del sistema.
-- Quién lo hizo, cuándo, qué cambió exactamente.
-- ═══════════════════════════════════════

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,
  -- 'vehicle'|'driver'|'trip'|'geofence'|'event_rule'|'avl_user'|
  -- 'sensor_config'|'user'|'alarm_exclusion'|'carbon_settings'|...
  entity_id       UUID         NOT NULL,
  action          VARCHAR(30)  NOT NULL,
  -- 'create'|'update'|'delete'|'activate'|'deactivate'|'block'|'unblock'
  changed_by      UUID         REFERENCES users(id),
  changed_by_email VARCHAR(254),  -- Desnormalizado para que el log sea legible sin JOINs
  changed_by_role  VARCHAR(50),
  ip_address      VARCHAR(45),
  previous_data   JSONB,         -- Snapshot del objeto ANTES del cambio
  new_data        JSONB,         -- Snapshot del objeto DESPUÉS del cambio
  changed_fields  TEXT[],        -- Lista de campos que cambiaron (ej: ['status','driver_id'])
  timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity    ON audit_log (entity_type, entity_id, timestamp DESC);
CREATE INDEX idx_audit_tenant    ON audit_log (tenant_id, timestamp DESC);
CREATE INDEX idx_audit_user      ON audit_log (changed_by, timestamp DESC);

-- ═══════════════════════════════════════
-- EXCLUSIONES DE ALARMAS (AlarmTypeExclusion)
-- Reglas inteligentes que suprimen alertas en contextos específicos.
-- Configurable por cliente, viaje, geocerca, franja horaria, tipo de alerta.
-- NUNCA suprimen el registro — solo suprimen la NOTIFICACIÓN al operador.
-- ═══════════════════════════════════════

CREATE TABLE alarm_exclusions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,

  -- ¿A qué tipo de alerta aplica esta exclusión?
  event_type      VARCHAR(100),  -- NULL = aplica a todos los tipos
  severity_filter VARCHAR(20),   -- NULL = aplica a todas las severidades

  -- ¿En qué contexto aplica la exclusión?
  scope_type      VARCHAR(30)  NOT NULL DEFAULT 'global_tenant',
  -- 'global_tenant'|'vehicle'|'operation'|'trip'|'geofence'
  scope_id        UUID,          -- NULL si scope_type='global_tenant'

  -- ¿Cuándo aplica la exclusión?
  -- Franja horaria (ej: no alertar paradas nocturnas entre 22hs y 6hs)
  time_from       TIME,          -- NULL = sin restricción horaria
  time_to         TIME,          -- NULL = sin restricción horaria
  days_of_week    SMALLINT[],    -- NULL = todos los días. Ej: [1,2,3,4,5] = lunes a viernes

  -- Zona geográfica donde aplica la exclusión
  -- (ej: dentro de esta geocerca no se alerta parada no autorizada)
  geofence_id     UUID         REFERENCES geofences(id),

  -- Estado del viaje donde aplica la exclusión (inspirado en SIMON AlarmTypeExclusion)
  -- Si el viaje está en este estado, la exclusión se activa automáticamente
  trip_status_filter VARCHAR(30),
  -- NULL = aplica en cualquier estado del viaje
  -- 'authorized_stop' → si el viaje está en parada autorizada, suprimir alarmas de parada
  -- 'at_checkpoint'   → si está en zona de control, suprimir exceso de velocidad
  -- 'in_progress'|'deviated'|'at_risk' → solo suprimir en este estado específico
  -- Ejemplos de negocio:
  --   "No alertar PARADA_NO_AUTORIZADA cuando el viaje está en estado authorized_stop"
  --   "No alertar VELOCIDAD cuando el viaje está en zona de checkpoint (velocidad reducida)"

  -- ¿Qué hace con la alerta excluida?
  exclusion_action VARCHAR(30)  NOT NULL DEFAULT 'suppress_notification',
  -- 'suppress_notification' → guarda en log pero NO notifica al operador
  -- 'downgrade_severity'    → baja la severidad (critical→warning, warning→info)
  -- 'add_to_chronic_queue'  → va a la cola de crónicas para revisión posterior

  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,  -- SWITCH
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE alarm_exclusions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_command_history ENABLE ROW LEVEL SECURITY;
-- audit_log NO tiene RLS — el rusertech_admin debe poder verlo todo

-- ═══════════════════════════════════════
-- COLA DE ALARMAS CRÓNICAS (AlarmChronic)
-- Alertas que se repiten mientras la condición persiste.
-- NUNCA se descartan. Se encolan cronológicamente.
-- El operador ve la frecuencia real del problema.
-- ═══════════════════════════════════════

CREATE TABLE alarm_chronic_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID         NOT NULL,
  vehicle_id      UUID         NOT NULL REFERENCES vehicles(id),
  trip_id         UUID         REFERENCES trips(id),
  rule_id         UUID         REFERENCES event_rules(id),
  parent_event_id UUID         REFERENCES event_logs(id),  -- Alerta original que inició la serie
  event_type      VARCHAR(100) NOT NULL,
  severity        VARCHAR(20)  NOT NULL,
  triggered_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  measured_value  DECIMAL(10,2),  -- El valor que disparó la alerta (ej: velocidad=120, temp=42.5)
  occurrence_count INTEGER      NOT NULL DEFAULT 1,  -- Cuántas veces consecutivas ocurrió
  metadata_json   JSONB        NOT NULL DEFAULT '{}',
  was_notified    BOOLEAN      NOT NULL DEFAULT FALSE,  -- Si llegó al operador o fue excluida
  exclusion_id    UUID         REFERENCES alarm_exclusions(id)  -- Qué exclusión la suprimió si aplica
);
CREATE INDEX idx_chronic_vehicle ON alarm_chronic_queue (vehicle_id, triggered_at DESC);
CREATE INDEX idx_chronic_parent  ON alarm_chronic_queue (parent_event_id);

CREATE TABLE outbox_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_name   VARCHAR(200) NOT NULL,   -- BullMQ queue name
  job_name     VARCHAR(200) NOT NULL,   -- Nombre del job
  payload      JSONB        NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count  SMALLINT     NOT NULL DEFAULT 0,
  error_msg    TEXT
);
CREATE INDEX idx_outbox_pending ON outbox_messages (status, created_at)
  WHERE status = 'pending';

-- ═══════════════════════════════════════
-- ROW-LEVEL SECURITY — Aplicar en todas las tablas de negocio
-- ═══════════════════════════════════════

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE avl_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE avl_event_dictionary  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips                ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_deviations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_configs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_logs          ENABLE ROW LEVEL SECURITY;

-- Política base (replicar en cada tabla):
-- El app_user NestJS setea: SET app.current_tenant_id = '{uuid}'
-- antes de cada query. Supabase usa service_role para migrations.

CREATE POLICY tenant_isolation ON vehicles
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
-- [Aplicar misma política en todas las tablas listadas arriba]
```

---

## 📦 TRIPTYQUERYFILTER DTO — Punto único de filtrado (Regla 35)

```typescript
// src/trips/dto/trip-query-filter.dto.ts
// Todos los filtros del FilterDrawer se mapean a este DTO.
// Un único query builder en TripQueryService — nunca endpoints separados por filtro.
export class TripQueryFilterDto {
  // ── IDENTIDAD ──────────────────────────────────────────────────
  tripId?:          string;   // ID interno del viaje
  manifestRef?:     string;   // external_reference (manifiesto / guía de carga)

  // ── ACTORES ────────────────────────────────────────────────────
  plate?:           string;   // Búsqueda parcial en vehicles.plate
  driverSearch?:    string;   // full_name O document del conductor
  operationId?:     string;   // FK operations.id
  tenantId?:        string;   // Solo rusertech_admin

  // ── ESTADO ─────────────────────────────────────────────────────
  travelStatuses?:  string[];
  // ['draft','scheduled','in_progress','deviated','at_risk',
  //  'authorized_stop','at_checkpoint','completed','cancelled']
  trackingStatuses?: string[];
  // ['at_checkpoint','authorized_stop','deviated','at_risk']
  commStatus?: 'no_signal_15m' | 'no_signal_30m' | 'no_signal_60m';
  // Evalúa contra Redis vehicle:position:{vehicleId}.timestamp

  // ── TEMPORAL ───────────────────────────────────────────────────
  plannedStartFrom?: Date;  plannedStartTo?: Date;
  plannedEndFrom?:   Date;  plannedEndTo?:   Date;
  createdFrom?:      Date;  createdTo?:      Date;

  // ── GEOGRÁFICO ─────────────────────────────────────────────────
  routeId?:          string;   // FK routes.id
  originId?:         string;   // FK saved_locations.id
  destinationId?:    string;   // FK saved_locations.id
  insideGeofenceId?: string;
  // Trips cuyo vehículo está ACTUALMENTE dentro de la geocerca.
  // Requiere Redis geofence:status:{vehicleId}:{geoId} === 'inside'

  // ── RIESGO ─────────────────────────────────────────────────────
  riskLevels?:     string[];   // ['normal','elevated','high','critical']
  alarmTypes?:     string[];
  // ['sos_alert','unauthorized_stop','speed_exceeded','route_deviation','signal_loss']
  chronicOnly?:    boolean;    // true = alertas abiertas >2h sin tratar
  withExclusions?: boolean;    // true = trips con alarm_exclusions activas

  // ── PAGINACIÓN ─────────────────────────────────────────────────
  page:     number;   // default: 1
  pageSize: number;   // default: 25, max: 100
  sortBy?:  'planned_start' | 'created_at' | 'risk_score' | 'status';
  sortDir?: 'asc' | 'desc';   // default: 'desc'
}

// Pills rápidas del FleetPanel mapean internamente a este DTO:
//   'Con Alertas' → travelStatuses: ['in_progress','deviated','at_risk']
//   'En Viaje'    → travelStatuses: ['in_progress']
//   'Sin Señal'   → commStatus: 'no_signal_15m'
//   'Bloqueados'  → consulta directa vehicles.is_blocked (no usa este DTO)

// Endpoint unificado — NUNCA crear endpoints específicos por tipo de filtro:
// GET /api/v1/trips?plate=ABC&travelStatuses[]=in_progress&riskLevels[]=critical&page=1&pageSize=25
```

---

# PARTE 0 — SITIO PÚBLICO Y MARKETING

> Esta parte es **previa** a la infraestructura del SaaS (PARTE II).
> Es 100% frontend React. No modifica NestJS ni la base de datos.
> Se puede construir en paralelo o antes del Bloque 0 de infraestructura.
> Comparte tokens del Design System con el SaaS pero tiene layout independiente.

---

### 🔨 BLOQUE -1 — SITIO PÚBLICO (LANDING PAGE)
**Objetivo:** Sitio público de rusertech.com con 4 páginas, Layout Público separado, tokens del Design System y formulario de contacto (UI estructural).
**Tiempo estimado:** 2-3 días
**Stack exclusivo de este bloque:** React 18 + TypeScript + React Router v6 + TailwindCSS. Sin NestJS. Sin Socket.io. Sin Zustand del SaaS.
**Referencia de diseño obligatoria:** Design System del Master Prompt (colores, tipografía, sombras). Regla 46.

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE -1
═══════════════════════════════════════════════════════

Este es el BLOQUE -1 de Rusertech. Es previo al Bloque 0 de infraestructura.
Construir el sitio público de rusertech.com.

LECTURA OBLIGATORIA ANTES DE CUALQUIER CÓDIGO:
1. Regla 46 completa (separación de responsabilidades — Sitio Público vs SaaS).
2. Regla 5 (tokens de diseño — ningún color hardcodeado).
3. Regla 10 (logo Rusertech visible en todas las pantallas).
4. Design System completo (colores, tipografía, sombras).

REGLA DE ORO DE ESTE BLOQUE:
El Layout Público no importa Socket.io, Zustand del SaaS ni lógica de telemetría.
Si el usuario tiene sesión activa e intenta ir a `/` → redirect a `/map`.
Todo color, fuente y sombra proviene de los tokens. Cero valores hardcodeados.

═══════════════════════════════════════
1. ARQUITECTURA DE RUTAS
═══════════════════════════════════════

Estructura en apps/web/src/:
  layouts/
    PublicLayout.tsx      ← Header + Outlet + Footer (AISLADO del AppLayout)
    AppLayout.tsx         ← Layout del SaaS (sin cambios)
  pages/public/
    HomePage.tsx          ← Ruta: /
    NosotrosPage.tsx      ← Ruta: /nosotros
    ServiciosPage.tsx     ← Ruta: /servicios
    ContactoPage.tsx      ← Ruta: /contacto
  pages/auth/
    LoginPage.tsx         ← Ruta: /login (ya existía — sin cambios)

Router config (React Router v6):
  <Routes>
    {/* Rutas públicas — PublicLayout */}
    <Route element={<PublicLayout />}>
      <Route path="/"          element={<HomePage />} />
      <Route path="/nosotros"  element={<NosotrosPage />} />
      <Route path="/servicios" element={<ServiciosPage />} />
      <Route path="/contacto"  element={<ContactoPage />} />
    </Route>
    {/* Login — sin layout */}
    <Route path="/login" element={<LoginPage />} />
    {/* Rutas privadas del SaaS — AppLayout + ProtectedRoute */}
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/map"        element={<MapPage />} />
      <Route path="/trips"      element={<TripListPage />} />
      {/* ... resto de rutas del SaaS */}
    </Route>
  </Routes>

REDIRECCIÓN (Regla 46b):
  En HomePage, NosotrosPage, ServiciosPage y ContactoPage:
    const { token } = useAuthStore();
    if (token) return <Navigate to="/map" replace />;
  Implementar con un componente PublicGuard reutilizable.

═══════════════════════════════════════
2. PUBLIC LAYOUT — PublicLayout.tsx
═══════════════════════════════════════

HEADER (altura: 64px, position: sticky top-0, z-index: 100):
  background: rgba(31,42,90,0.97) + backdrop-filter: blur(16px)
  borderBottom: 1px solid rgba(124,255,60,0.15)
  Contenido:
    Logo: ícono "R" con gradiente accent + texto "RUSERTECH" (Exo 2, weight 800)
    Nav links: Inicio · Nosotros · Servicios · Contacto
      color inactivo: textSecondary (#9CA3AF)
      color activo (NavLink): textPrimary (#E5E7EB) + underline accentGreen
    Botón "Iniciar Sesión" → /login
      background: gradiente accent (linear-gradient(135deg, #7CFF3C, #33E1A1, #2AB3FF))
      color texto: textOnAccent (#1F2A5A)
      border-radius: 8px, padding: 8px 20px
      font: DM Sans, weight 700

FOOTER (padding: 40px 0):
  background: bgStart (#1F2A5A)
  borderTop: 1px solid rgba(124,255,60,0.15)
  Contenido (3 columnas):
    Col 1: Logo + tagline "Seguridad & Logística"
    Col 2: Links: Inicio · Nosotros · Servicios · Contacto
    Col 3: Contacto: info@rusertech.com · rusertech.com
  Pie: "© 2026 Rusertech. Todos los derechos reservados."
  color: textMuted (#6B7280), fuente: DM Sans

═══════════════════════════════════════
3. PÁGINAS — CONTENIDO Y DISEÑO
═══════════════════════════════════════

── / (HOME) ──

HERO SECTION:
  background: linear-gradient(180deg, #1F2A5A 0%, #2B2F6E 100%)
  padding: 120px 0 80px
  Título (Exo 2, extrabold, 48px):
    "Transforma la telemetría de tu flota
     en inteligencia financiera."
  Subtítulo (DM Sans, 18px, textSecondary):
    "Rusertech no es solo un mapa de puntos en movimiento.
     Es el control en tiempo real de tu mayor activo operativo:
     cada kilómetro recorrido, cada desvío, cada parada.
     Convertidos en datos que protegen tu dinero."
  2 CTAs:
    Primario: "Solicitar demo" → /contacto
      (gradiente accent, textOnAccent, padding: 14px 32px, border-radius: 10px)
    Secundario: "Ver servicios" → /servicios
      (background: transparent, border: 1px solid accentGreen,
       color: accentGreen, mismo padding)

FEATURES SECTION (3 cards):
  Título sección: "Todo lo que necesitás para operar con certeza"
    (Exo 2, bold, 32px, textPrimary, centrado)
  Grid 3 columnas, gap 24px:

  Card 1 — Combustible y Eficiencia:
    Ícono: ⛽
    Título: "Control de combustible"
    Descripción: "Detecta consumos anómalos, paradas no autorizadas
    y desvíos de ruta antes de que impacten en tu estado de resultados."

  Card 2 — Seguridad de Carga:
    Ícono: 🔒
    Título: "Seguridad de carga"
    Descripción: "Alertas en tiempo real, bloqueo remoto de vehículos
    y notificaciones automáticas a prestadores AVL ante cualquier incidente."

  Card 3 — Analytics Operativo:
    Ícono: 📊
    Título: "Analytics que generan ahorro"
    Descripción: "KPIs de flota, huella de carbono, rendimiento por chofer
    y comparativas mensuales. Todo exportable a Excel."

  Estilo cards:
    background: bgSurface (#252D6B)
    border: 1px solid rgba(124,255,60,0.15)
    borderRadius: 12px
    padding: 32px 24px
    boxShadow: 0 4px 24px rgba(0,0,0,0.45)
    Ícono: fontSize 40px, marginBottom 16px
    Título: Exo 2, bold, 20px, textPrimary
    Descripción: DM Sans, 14px, textSecondary, lineHeight 1.6

CTA FINAL:
  background: bgSurface, border: 1px solid borderAccent
  padding: 60px 40px, borderRadius: 16px, textAlign: center
  Título: "¿Listo para tomar el control de tu flota?"
  Subtítulo: "Hablemos. Sin compromiso, sin tecnicismos."
  Botón: "Contactar ahora" → /contacto (gradiente accent)

── /nosotros ──

Hero simple:
  Título: "Quiénes somos"
  Subtítulo: "Tecnología satelital con foco en resultados"

Cuerpo (2 columnas en desktop):
  Col izquierda — Texto corporativo:
    "Rusertech es una plataforma SaaS especializada en seguimiento
    satelital vehicular para operaciones de logística, transporte de
    carga y distribución en Argentina y la región.
    
    Nuestra misión es transformar los datos de telemetría GPS en
    inteligencia operativa: reducir costos, prevenir siniestros y
    dar a los gerentes de flota visibilidad total sobre sus activos.
    
    No somos un proveedor de hardware GPS. Somos la capa de inteligencia
    que se conecta a los prestadores AVL existentes y convierte sus datos
    en dashboards accionables, alertas configurables y reportes financieros."

  Col derecha — 3 pilares (cards simples):
    🛰️ Tecnología  |  🔐 Seguridad  |  📈 Resultados

── /servicios ──

Título: "Nuestros módulos"
Subtítulo: "Una plataforma modular que crece con tu operación"

Lista de módulos (cards apiladas con ícono + título + descripción):

  1. 🗺️ Monitoreo en Tiempo Real (MapLibre GL JS)
     "Mapa vectorial de alta performance con marcadores animados,
     geocercas configurables, zonas sin señal y reproducción histórica.
     Sin costos de tiles — tecnología OpenFreeMap."

  2. 🛣️ Gestión de Viajes y Recorridos
     "Declaración de viajes con wizard de 4 pasos, recorridos reutilizables,
     validación pre-ruta geoespacial y motor de riesgo dinámico por scoring."

  3. 🚨 Motor de Alertas Multicanal
     "Reglas configurables por vehículo, viaje u operación. Notificaciones
     por email, push, WhatsApp y webhook. Alertas críticas, advertencias
     e informativas ordenadas por severidad."

  4. 🌡️ Control de Temperatura y Humedad
     "Monitoreo de sensores en tiempo real con rangos configurables,
     historial gráfico y alertas automáticas. Crítico para cargas
     refrigeradas y farmacéuticas."

  5. 🌿 Huella de Carbono
     "Cálculo automático de CO₂ por viaje completado. Compatible con
     Climatiq API para reportes verificables. Exportable a Excel."

  6. 📊 Analytics y Reportes
     "Dashboard con KPIs de flota, distribución de viajes, alertas por
     tipo y tendencias. Selector de período semana/mes. Export CSV y XLSX."

── /contacto ──

Título: "Hablemos"
Subtítulo: "Completá el formulario y te contactamos en menos de 24 horas."

FORMULARIO (sin POST real — solo UI estructural):
  Campos:
    Nombre completo*    → type="text"
    Email corporativo*  → type="email"
    Empresa*            → type="text"
    Tamaño de flota     → type="select":
                          opciones: "1-10 vehículos" / "11-50" /
                                    "51-200" / "Más de 200"
    Mensaje             → textarea, rows=4

  Estilo inputs:
    background: bgSurfaceHigh (#2E3578)
    border: 1px solid rgba(124,255,60,0.15)
    borderRadius: 8px, padding: 10px 14px
    color: textPrimary, fontFamily: DM Sans
    focus → border: 1px solid rgba(124,255,60,0.50)
    placeholder → color: textMuted

  Botón "Enviar consulta":
    background: gradiente accent
    color: textOnAccent, fontWeight: 700
    padding: 12px 32px, borderRadius: 8px, width: 100%
    Al hacer click (sin POST real): mostrar mensaje de éxito inline:
    "✅ ¡Gracias! Te contactamos en menos de 24 horas."
    (usar useState local — no conecta con backend en este bloque)

  Información lateral (en desktop, columna derecha):
    📧 info@rusertech.com
    🌐 rusertech.com
    📍 Argentina

═══════════════════════════════════════
4. CHECKLIST DE VALIDACIÓN BLOQUE -1
═══════════════════════════════════════

□ PublicLayout renderiza sin importar nada del SaaS (Socket.io, Zustand, telemetría)
□ Usuario con sesión activa en / → redirect a /map
□ Usuario sin sesión en / → ve la landing normalmente
□ Header sticky funciona en scroll
□ Botón "Iniciar Sesión" en Header → /login
□ Logo visible en Header y Footer
□ 3 cards de Features con estilos del Design System (bgSurface, border, shadow)
□ Inputs del formulario /contacto con bgSurfaceHigh y focus con borderAccent
□ Click en "Enviar consulta" muestra mensaje de éxito sin llamada al backend
□ Ningún color hardcodeado — todo desde tokens
□ Tipografías: Exo 2 (títulos) y DM Sans (body) — sin Arial/Roboto/Inter
□ Responsive: layout mobile funciona (columnas apiladas en < 768px)
□ /servicios lista los 6 módulos con descripción correcta
```

---

# PARTE II — BLOQUES DE CONSTRUCCIÓN

---

### 🔨 BLOQUE 0 — INFRAESTRUCTURA Y CREDENCIALES
**Objetivo:** Repositorio base, conexiones a Supabase y Upstash, migraciones corriendo.
**Tiempo estimado:** 1-2 días
**Prerequisito:** Ninguno. Es el primero.

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 0 — COPIAR Y PEGAR EN EL IDE
═══════════════════════════════════════════════════════

Somos el equipo de Rusertech. Vamos a construir una plataforma SaaS de 
seguimiento satelital vehicular. Este es el Bloque 0 del proyecto.

ANTES DE GENERAR CÓDIGO, necesito que me pidas los siguientes datos
en este orden exacto. Pausá y esperá mi respuesta antes de continuar:

PASO 1 — SUPABASE:
  "Necesito el Connection String de tu proyecto Supabase.
   Lo encontrás en: Supabase Dashboard → Settings → Database → Connection string → URI
   Formato esperado: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
  [ESPERAR RESPUESTA]

PASO 2 — UPSTASH REDIS:
  "Necesito las credenciales de tu instancia Upstash Redis.
   Las encontrás en: Upstash Console → tu base de datos → REST API
   Necesito: UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN"
  [ESPERAR RESPUESTA]

PASO 3 — MAPA (OpenFreeMap — sin token):
  "Perfecto. El stack de mapas usa OpenFreeMap + MapLibre GL JS.
   No requiere API key ni registro. Los tiles son públicos y gratuitos.
   URL: https://tiles.openfreemap.org/styles/bright
   No necesito ninguna credencial adicional para mapas."

Con esas credenciales, proceder a:

1. ESTRUCTURA DEL REPOSITORIO:
   Crear monorepo con la siguiente estructura:
   rusertech/
   ├── apps/
   │   ├── api/          (NestJS backend)
   │   └── web/          (React + Vite frontend)
   ├── packages/
   │   └── shared/       (tipos compartidos TypeScript)
   ├── infra/
   │   ├── docker-compose.yml
   │   ├── nginx/nginx.conf
   │   └── migrations/   (SQL ordenado)
   ├── .env.example      (plantilla con todas las variables)
   └── .gitignore        (.env* ignorados)

2. ARCHIVO .env (en apps/api/.env — NUNCA commiteado):
   DATABASE_URL="[supabase_connection_string]"
   REDIS_URL="[upstash_redis_url]"
   REDIS_TOKEN="[upstash_redis_token]"
   JWT_SECRET="[generar string random 64 chars]"
   JWT_REFRESH_SECRET="[generar string random 64 chars]"
   OPENFREEMAP_NO_TOKEN_REQUIRED="[mapbox_token]"
   CLIMATIQ_API_KEY=""  # Vacío hasta activar
   NODE_ENV="development"
   PORT=3000
   CORS_ORIGIN="http://localhost:5173"

3. NESTJS APP SETUP (apps/api):
   Instalar: @nestjs/core @nestjs/common @nestjs/platform-fastify
   @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/cqrs
   @nestjs/bull bull ioredis @socket.io/redis-adapter
   @prisma/client prisma class-validator class-transformer
   pino pino-http @opentelemetry/sdk-node
   bcrypt uuid cockatiel

4. PRISMA SETUP:
   - Inicializar Prisma con el DATABASE_URL de Supabase
   - Crear schema.prisma con TODOS los modelos del Master Prompt
   - Ejecutar: npx prisma migrate dev --name init
     EXCEPCIÓN: la tabla telemetry NO usa prisma migrate dev — ver paso siguiente
   - Verificar en Supabase Dashboard que las tablas aparecen
   - Activar RLS en todas las tablas listadas
   - Aplicar política tenant_isolation en cada tabla

   SETUP DE TELEMETRÍA (Regla 45 — elegir UNO según entorno):

   CON USE_TIMESCALEDB=false (DEFAULT — Supabase Free, cualquier PostgreSQL):
     Agregar en apps/api/.env: USE_TIMESCALEDB=false
     Ejecutar en orden:
       psql $DATABASE_URL -f prisma/migrations/001_telemetry_partitioned.sql
       psql $DATABASE_URL -f prisma/migrations/002_telemetry_partition_cron.sql
     El segundo archivo configura pg_cron para auto-crear particiones mensuales.
     pg_cron está disponible en Supabase Free sin configuración adicional.

   CON USE_TIMESCALEDB=true (Supabase Pro o instancia propia):
     Agregar en apps/api/.env: USE_TIMESCALEDB=true
     Ejecutar:
       psql $DATABASE_URL -f prisma/migrations/001_telemetry_hypertable.sql
     TimescaleDB debe estar habilitado en la instancia antes de ejecutar.

   En ambos casos: prisma.telemetry.create() funciona de forma idéntica.
   El código de aplicación NO necesita saber qué modo está activo.

5. SEED DE DATOS:
   Crear prisma/seed.ts que inserte:
   - Roles del sistema (los 6 definidos en el Master Prompt)
   - Tenant demo: name="Rusertech Demo", slug="demo"
   - Usuario admin: email="admin@rusertech.com", role=rusertech_admin
   - 1 avl_user de prueba: user_avl_code="demo_avl_01", name="AVL Demo"
     con api_key="demo-key-12345" (solo para tests locales)
   - Diccionario para ese avl_user: "01"→"ignition_on", "02"→"ignition_off", "03"→"speed_exceeded"
   - 2 vehículos de prueba vinculados al avl_user: hub_asset_id="DEMO001" y "DEMO002"
   - Carbon settings para el tenant demo con use_climatiq_api=false

6. REACT APP SETUP (apps/web):
   Vite + React 18 + TypeScript strict
   TailwindCSS configurado con los tokens del Design System del Master Prompt
   Zustand, TanStack Query, Axios, React Router v6
   maplibre-gl, @mapbox/mapbox-gl-draw (compatible con MapLibre), @tmcw/togeojson
   Apache ECharts (echarts + echarts-for-react)
   Google Fonts en index.html: Exo 2, DM Sans, JetBrains Mono
   Copiar logo_rusertech.png a apps/web/public/assets/

7. CHECKLIST DE VALIDACIÓN:
   □ npx prisma migrate deploy corre sin errores
   □ npx prisma db seed corre sin errores
   □ Tablas visibles en Supabase Dashboard
   □ RLS activado (verificar en Supabase: Authentication → Policies)
   □ Tabla telemetry creada con el modo correcto:
       - USE_TIMESCALEDB=false: verificar que es tabla particionada
         (SELECT * FROM pg_partitioned_table WHERE partrelid='telemetry'::regclass)
       - USE_TIMESCALEDB=true: verificar hypertable
         (SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name='telemetry')
   □ pg_cron job creado (si USE_TIMESCALEDB=false):
       (SELECT * FROM cron.job WHERE jobname='rusertech-create-telemetry-partition')
   □ Redis connection funciona (test con ioredis ping)
   □ npm run dev en apps/api → API responde en localhost:3000
   □ npm run dev en apps/web → App carga en localhost:5173
```

---

### 🔨 BLOQUE 1 — AUTENTICACIÓN Y MULTI-TENANT
**Objetivo:** Login funcional. JWT. Roles. Tenant isolation activo.
**Tiempo estimado:** 2-3 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 1
═══════════════════════════════════════════════════════

Continuamos con Rusertech. El Bloque 0 está completo.
Construir el sistema de autenticación multi-tenant.

1. AUTH MODULE (apps/api/src/modules/auth/):

   POST /api/v1/auth/login
   Body: { email: string, password: string, tenantSlug: string }
   Proceso:
     a) Buscar tenant por slug → si no existe: 404 "Tenant no encontrado"
     b) Setear tenant en contexto (para RLS)
     c) Buscar usuario por email en ese tenant
     d) Verificar password con bcrypt.compare()
     e) Si OK: generar AccessToken (15min) + RefreshToken (7 días)
     f) Guardar RefreshToken en Redis: SET auth:refresh:{userId} {token} EX 604800
     g) Retornar: { accessToken, refreshToken, user: { id, email, fullName, role } }
   
   JWT Claims: { sub: userId, tenantId, tenantSlug, role, permissions[], iat, exp }

   POST /api/v1/auth/refresh
   Body: { refreshToken: string }
   → Validar en Redis, generar nuevo accessToken

   POST /api/v1/auth/logout
   → Eliminar refreshToken de Redis: DEL auth:refresh:{userId}

2. TENANT MIDDLEWARE:
   Para cada request autenticado, antes de cualquier query:
   a) Extraer tenantId del JWT claim
   b) Ejecutar: await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`
   c) Si no hay tenantId válido → 401

3. GLOBAL EXCEPTION FILTER:
   Mapear al cliente (nunca exponer stack traces):
   - ValidationError (class-validator) → 400 + lista de campos inválidos
   - NotFoundException → 404
   - UnauthorizedException → 401
   - ForbiddenException → 403
   - ConflictException → 409 (ej: placa duplicada)
   - Error genérico → 500 + log con Pino (sin detalle al cliente)
   Formato de respuesta: { statusCode, message, errors?: string[], timestamp }

4. GUARDS:
   - JwtAuthGuard: verifica token en Authorization: Bearer
   - RolesGuard: verifica que role del JWT tenga el permiso requerido
   - TenantGuard: verifica que el recurso pertenece al tenant del JWT
   
   Decoradores:
   @Roles('account_owner', 'manager')  → solo esos roles pueden acceder
   @Public()  → endpoint sin auth (login, health)

5. FRONTEND — LOGIN PAGE:
   Ruta: /login
   Full-screen con gradiente de fondo #1F2A5A → #2B2F6E
   Logo Rusertech centrado (grande, con efecto glow suave)
   Form: Empresa (tenantSlug), Email, Password
   Botón "Ingresar" con gradiente acento #7CFF3C → #33E1A1 → #2AB3FF
   Error states claros: tenant no encontrado, credenciales inválidas
   Al login exitoso: guardar tokens en memory (Zustand) + httpOnly cookie para refresh
   Redirigir a /map

6. RUTAS PROTEGIDAS:
   ProtectedRoute component: si no hay token → redirect a /login
   RoleRoute component: si no tiene el role necesario → /403

7. CHECKLIST:
   □ POST /auth/login con datos del seed → retorna JWT
   □ Request sin token a ruta protegida → 401
   □ Token expirado → 401 con mensaje claro
   □ Login en frontend funciona y redirige a /map
   □ Logout elimina tokens de Redis y limpia estado Zustand
```

---

### 🔨 BLOQUE 2 — INGESTA DE TELEMETRÍA DEL HUB
**Objetivo:** El HUB puede enviar posiciones. Se validan, normalizan y persisten con Outbox.
**Tiempo estimado:** 3-4 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 2
═══════════════════════════════════════════════════════

Continuamos con Rusertech. Bloques 0 y 1 completos.
Construir el pipeline completo de ingesta de telemetría del HUB.

CONTEXTO CRÍTICO:
- El HUB no usa JWT. Usa API Key en header X-Hub-Api-Key.
- Cada API Key está asociada a un gps_provider que pertenece a un tenant.
- temperature y humidity vienen del sensor del vehículo. Solo guardar.
- shipment, user_avl, source_tag, alert → guardar SOLO en raw_payload. Ignorar en lógica.

1. ENDPOINT DE INGESTA:
   POST /api/v1/telemetry/ingest
   Auth: X-Hub-Api-Key header (NO JWT)
   Rate limit: 10.000 req/min por API Key
   
   Proceso completo en orden:

   PROCESO DE INGESTA — PIPELINE COMPLETO:

   a) VALIDAR API KEY DEL AVL_USER:
      Buscar en Redis: GET avl:apikey:{apiKey} → { avlUserId, tenantId, userAvlCode }
      Si no está en cache: buscar en DB en avl_users WHERE api_key={apiKey} AND is_active=true
      Si no existe → 401 "API Key inválida o AVL User inactivo"
      Si avl_user.is_active=false → 403 "AVL User desactivado"
      Cache resultado: SET avl:apikey:{apiKey} {json} EX 3600
      
      IMPORTANTE: El campo User_avl del payload debe coincidir con avl_users.user_avl_code.
      Si no coincide → 401 "User_avl no autorizado para esta API Key"
      Esto garantiza que nadie puede falsificar un User_avl ajeno.

   b) PARSEAR Y NORMALIZAR campos del HubRawPayload:
      Asset      → string (obligatorio)
      Latitude   → number (ya es number en el payload)
      Longitude  → number (ya es number en el payload)
      Speed      → parseFloat() → number | null
      Code       → string | null (guardar como provider_code)
      Date       → new Date(payload.Date) con manejo de timezone
      Course     → parseInt() → number | null (heading_degrees)
      Ignition   → payload.Ignition === '1' → boolean | null
      Altitude   → parseFloat() → number | null
      Odometer   → parseFloat() → number | null
      Battery    → parseFloat() → number | null
      Temperature→ parseFloat() → number | null (puede ser "")
      Humidity   → parseFloat() → number | null (puede ser "")
      Direction  → string | null
      SerialNumber→ string | null
      raw_payload→ el objeto completo original sin modificar

   c) VALIDACIONES LÓGICAS — NUNCA DESCARTAR, MARCAR Y ORDENAR:
      Rechazar solo si la estructura es inválida (lat/lng fuera de rango, asset vacío).
      Para todo lo demás, guardar y marcar:

      - latitude fuera de [-90, 90] → 400 (dato técnicamente imposible)
      - longitude fuera de [-180, 180] → 400 (dato técnicamente imposible)
      - speed fuera de [0, 300] → guardar con is_anomalous=true, no rechazar
      - timestamp más de 48h en el pasado → guardar con is_out_of_order=true
      - timestamp más de 5 minutos en el futuro → guardar con is_out_of_order=true

      ANTI TIME-TRAVEL (inspirado en AddAvlRecordCommand de SIMON):
      El sistema NUNCA descarta puntos GPS out-of-order.
      Los guarda todos. El orden cronológico se resuelve en la CONSULTA, no en la ingesta.
      
      Al guardar: comparar timestamp con Redis: GET vehicle:last_ts:{vehicleId}
        Si timestamp < last_ts → marcar is_out_of_order=true en telemetría
        Si timestamp >= last_ts → actualizar Redis: SET vehicle:last_ts:{vehicleId} {timestamp}
      
      La máquina de estados (TrackingFlow) y el mapa usan siempre:
        ORDER BY timestamp ASC → cronología correcta garantizada
      
      El campo is_out_of_order es solo para auditoría técnica.
      El operador nunca lo ve — el mapa siempre se ve correcto.

   d) RESOLVER VEHÍCULO desde Asset + avlUserId:
      -- La combinación Asset + avl_user_id es única. Dos avl_users pueden tener el mismo Asset.
      Clave Redis: GET vehicle:asset:{avlUserId}:{asset} → vehicleId (UUID interno)
      Si no en cache: buscar en DB WHERE hub_asset_id=asset AND avl_user_id=avlUserId
      Si no existe → 404 "Vehículo no registrado. Asset: {asset} | AVL User: {userAvlCode}"
      Si existe pero is_blocked=true → 200 con body: 
        { status: "blocked", message: "Vehículo bloqueado. Datos descartados." }
        [No persistir nada. No es error del HUB.]
      Si existe: cache por 1 hora.

   e) INTERPRETAR CÓDIGO DEL PRESTADOR — via diccionario del avl_user:
      Si Code no es null:
        Buscar en Redis: GET avl:code:{avlUserId}:{code} → { eventType, triggersAlert, severity }
        Si no en cache: buscar en avl_event_dictionary WHERE avl_user_id=avlUserId AND raw_code=code
        Si no existe en diccionario: eventType = "unknown_code:{code}", log para que el admin lo vea
        Cache resultado EX 6h.

   f) DEDUPLICACIÓN:
      Clave Redis: GET dedup:{vehicleId}:{timestamp_unix}
      TTL: 5 minutos
      Si existe → retornar 200: { status: "duplicate", skipped: true }
      Si no existe: SET dedup:{vehicleId}:{timestamp_unix} 1 EX 300

   g) OUTBOX TRANSACTION (atómica — ambas o ninguna):
      await prisma.$transaction(async (tx) => {
        await tx.telemetry.create({ data: { ...normalized,
          avlUserId,   // SIEMPRE presente — trazabilidad completa
          location: `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` } });
        await tx.outboxMessages.create({ data: {
          queueName: 'telemetry.raw',
          jobName: 'processTelemetry',
          payload: { vehicleId, avlUserId, tenantId, timestamp, ...normalized }
        }});
      });
      // Actualizar last_data_at del avl_user (fire and forget):
      prisma.avlUsers.update({ where: { id: avlUserId }, data: { lastDataAt: new Date() } });

   h) GEOCODIFICACIÓN INVERSA (fire and forget — no bloquea la ingesta):
      Clave Redis: GET geocode:{lat_rounded}:{lng_rounded}
      (redondear a 4 decimales para maximizar cache hits)
      Si no está en cache:
        OPCIÓN PRIMARIA — Photon (OSM, sin API key, sin límites):
        GET https://photon.komoot.io/reverse?lat={lat}&lon={lng}&lang=es
        Extraer: properties.name + properties.city → "Av. Corrientes 1234, Buenos Aires"
        
        OPCIÓN SECUNDARIA — Nominatim (OSM, sin API key, límite 1 req/seg):
        GET https://nominatim.openstreetmap.org/reverse
          ?lat={lat}&lon={lng}&format=json&accept-language=es
        Header obligatorio: User-Agent: Rusertech/1.0 (contacto@rusertech.com)
        
        Usar Photon por defecto (más rápido, sin límite de rate).
        Fallback a Nominatim si Photon no responde en 2s.
        SET Redis: geocode:{lat}:{lng} "{address}" TTL: 86400 (24h, configurable)
      Guardar en Redis junto con la posición del vehículo:
        vehicle:position:{vehicleId} → incluir campo address: "{dirección legible}"
      La dirección se incluye en todos los eventos, alertas y notificaciones.
      
   i) POSITION FORWARDING (fire and forget — no bloquea la ingesta):
      Buscar en Redis: GET forwarders:tenant:{tenantId} → lista de forwarders activos
      Si no está en cache: cargar de DB WHERE tenant_id=tenantId AND is_active=true
      Cache: TTL 5 minutos
      Para cada forwarder activo:
        Si vehicle_filter no está vacío: verificar que vehicleId esté en la lista
        Si only_with_trip=true: verificar que haya trip activo para este vehículo
        Si min_speed_filter: verificar speedKmh >= min_speed_filter
        Si pasa todos los filtros: encolar en BullMQ 'forwarding.send' con payload completo
      Los workers de forwarding procesan la cola y envían al target_url.
      Circuit breaker por forwarder: si está circuit_open=true, saltar sin encolar.

   j) RETORNAR 202 Accepted (ingesta asíncrona)

2. OUTBOX PROCESSOR (NestJS Cron cada 100ms):
   - Buscar outbox_messages WHERE status='pending' ORDER BY created_at LIMIT 50
   - Para cada mensaje: agregar a BullMQ queue correspondiente
   - Si éxito: UPDATE status='sent', processed_at=NOW()
   - Si falla: retry_count++. Si >= 5: status='failed', log error con Pino
   - Usar cockatiel para retry con backoff: 1s, 2s, 4s, 8s, 16s

3. MÓDULO AVL USERS — LA SECCIÓN MÁS IMPORTANTE DE CONFIGURACIÓN:

   Este módulo reemplaza completamente la antigua sección de "Prestadores GPS".
   Es donde el operador configura TODO lo relacionado a cada User_avl.

   Endpoints:
   GET    /api/v1/avl-users                          → lista de avl_users del tenant
   GET    /api/v1/avl-users/{id}                     → detalle completo
   POST   /api/v1/avl-users                          → crear nuevo avl_user
   PUT    /api/v1/avl-users/{id}                     → actualizar
   DELETE /api/v1/avl-users/{id}                     → eliminar (si no tiene telemetría)
   PATCH  /api/v1/avl-users/{id}/toggle              → activar/desactivar ingesta (SWITCH)
   POST   /api/v1/avl-users/{id}/regenerate-api-key  → nueva API Key
   GET    /api/v1/avl-users/{id}/credentials         → ver credenciales desencriptadas (solo manager+)

   Diccionario de eventos por avl_user:
   GET    /api/v1/avl-users/{id}/dictionary
   POST   /api/v1/avl-users/{id}/dictionary          → { rawCode, eventType, description, triggersAlert, severity }
   PUT    /api/v1/avl-users/{id}/dictionary/{dictId}
   DELETE /api/v1/avl-users/{id}/dictionary/{dictId}
   PATCH  /api/v1/avl-users/{id}/dictionary/{dictId}/toggle  → SWITCH por código

   Códigos desconocidos:
   GET    /api/v1/avl-users/{id}/unknown-codes
   → Lista de codes recibidos que no están en el diccionario.
   → El operador los ve, los entiende, y puede agregarlos al diccionario desde aquí.

   FRONTEND — /avl (sección AVL en sidebar):

   AvlUserListPage:
   - Cards (no tabla) — una por avl_user, con:
     Header: nombre del avl_user + badge estado (activo/inactivo)
     Métricas: vehículos asociados, último dato recibido (hace X minutos)
     SWITCH prominente: Activar/Desactivar ingesta
     Botones: Configurar | Ver Diccionario | Credenciales
   
   AvlUserForm (crear/editar):
   Sección 1 — IDENTIFICACIÓN:
     - Nombre descriptivo (ej: "Flota Norte — TeltonikaPro")
     - User AVL Code (el valor exacto que viene en el campo User_avl del HUB)
     - Descripción
   
   Sección 2 — CREDENCIALES DEL PRESTADOR (repositorio de acceso):
     - Nombre del prestador
     - URL del panel web del prestador
     - Usuario y Contraseña (campos con show/hide, guardados encriptados)
     - URL de API (si el prestador tiene)
     - API Key del prestador (encriptada)
     - Notas de acceso libre
     Banner informativo: "Estos datos son solo para consulta manual. No se usan automáticamente."
   
   Sección 3 — CONTROL:
     - API Key de Rusertech (auto-generada, mostrar con botón copiar y botón regenerar)
     - SWITCH activo/inactivo
   
   AvlEventDictionaryPage:
   - Tabla de códigos configurados con SWITCH individual por fila
   - Columnas: Código | Evento Estándar | Descripción | Genera Alerta | Severidad | Activo
   - Panel "Códigos Desconocidos" (si hay codes llegando sin mapear):
     Badge rojo con count si hay códigos sin mapear
     Lista: código | primera vez visto | veces recibido | botón "Agregar al diccionario"
     Al click "Agregar": abre form prellenado con el raw_code, solo falta el event_type

4. REDIS SCHEMA ACTUALIZADO:
   avl:apikey:{apiKey}               → { avlUserId, tenantId, userAvlCode }      TTL: 1h
   vehicle:asset:{avlUserId}:{asset} → vehicleId (UUID)                           TTL: 1h
   vehicle:position:{vehicleId}      → { lat, lng, speed, temp, hum, avlUser, ...} TTL: 1h
   avl:code:{avlUserId}:{code}       → { eventType, triggersAlert, severity }     TTL: 6h
   avl:unknown:{avlUserId}           → SET de códigos sin mapear                  TTL: sin límite
   dedup:{vehicleId}:{timestamp}     → "1"                                        TTL: 5min
   auth:refresh:{userId}             → refreshToken                               TTL: 7d

5. CHECKLIST:
   □ POST /telemetry/ingest con payload real del HUB → 202 Accepted
   □ Dato guardado en tabla telemetry con avl_user_id correcto
   □ Registro en outbox_messages creado en la misma transacción
   □ Redis vehicle:position actualizado (incluye campo avlUser para trazabilidad)
   □ HUB envía mismo punto dos veces → segundo retorna duplicate:true
   □ Vehículo bloqueado: datos descartados, HUB recibe 200 sin error
   □ Asset no registrado para ese avl_user → 404 con mensaje claro
   □ API Key inválida → 401
   □ User_avl del payload no coincide con el de la API Key → 401
   □ Código "01" del diccionario del avl_user demo → interpretado como "ignition_on"
   □ Código desconocido → guardado como "unknown_code:XX" + agregado a Redis avl:unknown:{avlUserId}
   □ Panel de códigos desconocidos muestra el code no mapeado con opción de agregarlo
   □ last_data_at del avl_user se actualiza con cada ingesta exitosa

6. AVL SIMULATOR (dev/staging únicamente):

   Habilitado solo si: process.env.AVL_SIMULATOR_ENABLED === 'true'
   Si está en producción y alguien intenta usarlo → 403 "Simulator not available in production"

   POST /api/v1/simulator/send
   Auth: JWT (solo manager+ o rusertech_admin)
   Body:
   {
     avlUserId: string,          // UUID del avl_user a simular
     vehicleId: string,          // UUID del vehículo
     lat: number,                // Latitud del punto a simular
     lng: number,                // Longitud del punto a simular
     speedKmh?: number,          // Default: 0
     ignition?: boolean,         // Default: true
     temperatureC?: number,      // Default: null
     humidityPct?: number,       // Default: null
     code?: string,              // Code del prestador (ej: "01" → ignition_on)
     timestamp?: string          // ISO 8601. Default: NOW()
   }
   Proceso: construye HubRawPayload completo y lo inyecta en el mismo pipeline
   de /telemetry/ingest internamente. El simulador ES el HUB — misma validación, misma lógica.
   Retorna la respuesta que habría dado el endpoint real.

   POST /api/v1/simulator/route
   Body: { avlUserId, vehicleId, routeGeoJson (LineString), intervalSeconds, speedKmh }
   → Simula un vehículo recorriendo una ruta completa, punto a punto, con el intervalo dado.
   → Usa BullMQ para encolar los puntos con delay entre ellos.
   → Útil para testear desvíos, zonas de control, y RiskLevel de un viaje completo.

   POST /api/v1/simulator/alert
   Body: { avlUserId, vehicleId, alertType, lat, lng }
   → Genera directamente un evento en el motor (saltea la ingesta GPS).
   → Para testear el flujo de notificaciones sin construir una ruta entera.
   → Solo tipos: 'speed_exceeded' | 'signal_loss' | 'geofence_enter' | 'sos'

   GET /api/v1/simulator/status
   → Lista los jobs de simulación activos en BullMQ.

   DELETE /api/v1/simulator/route/{jobId}
   → Cancela una simulación de ruta en curso.

   FRONTEND — Componente SimulatorPanel (solo visible si AVL_SIMULATOR_ENABLED=true):
   - Panel colapsable en la UI de desarrollo (badge "DEV" en esquina)
   - Formulario: seleccionar vehículo + avl_user, ingresar lat/lng o click en mapa
   - Botón "Enviar punto GPS" → llama a /simulator/send → toast con respuesta
   - Botón "Simular ruta" → dibuja en mapa, configura velocidad e intervalo
   - Botón "Lanzar alerta" → selector de tipo, posición en mapa
   - Monitor en tiempo real: muestra el log de puntos simulados enviados
   - Indicador visual en topbar: "🔬 MODO SIMULADOR ACTIVO" en ámbar cuando hay simulación en curso
```

---

### 🔨 BLOQUE 3 — GESTIÓN DE FLOTA Y GEOCERCAS
**Objetivo:** CRUD completo de vehículos, conductores, geocercas. Switch de bloqueo de vehículo.
**Tiempo estimado:** 3-4 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 3
═══════════════════════════════════════════════════════

Continuamos con Rusertech. Bloques 0, 1 y 2 completos.
Construir gestión de flota y geocercas.

1. MÓDULO VEHICLES:

   Endpoints:
   GET    /api/v1/vehicles              → lista paginada con filtros
   GET    /api/v1/vehicles/{id}         → detalle + última posición de Redis
   GET    /api/v1/vehicles/live         → SOLO Redis, todas las posiciones actuales
   POST   /api/v1/vehicles              → crear
   PUT    /api/v1/vehicles/{id}         → actualizar
   DELETE /api/v1/vehicles/{id}         → soft delete (status=inactive)
   PATCH  /api/v1/vehicles/{id}/block   → toggle is_blocked (SWITCH)
   
   El endpoint PATCH /block:
   Body: { blocked: boolean, reason?: string }
   Acción: UPDATE vehicles SET is_blocked={blocked}, block_reason={reason}
   Efecto inmediato: el siguiente punto GPS del HUB es descartado en ingesta.
   Retornar: { id, plate, isBlocked, blockReason }

4. MÓDULO DE UBICACIONES (/locations)

   Las Ubicaciones son los nodos operativos del sistema:
   depósitos, plantas, terminales, clientes, puertos. Son los puntos
   de origen y destino de los Recorridos.

   Endpoints:
   GET    /api/v1/locations
   GET    /api/v1/locations/{id}
   POST   /api/v1/locations
   PUT    /api/v1/locations/{id}
   DELETE /api/v1/locations/{id}
   PATCH  /api/v1/locations/{id}/toggle

   FRONTEND — LocationsPage (/locations):
   Lista con mapa lateral mostrando todos los puntos del tenant.
   Click en punto del mapa → selecciona esa ubicación.
   Formulario crear/editar:
     - Nombre + tipo (origen/destino/depósito/planta/cliente/puerto/control)
     - Dirección: input de texto + botón "Geocodificar" → llama Photon/Nominatim (OSM geocoding)
     - O click directo en el mapa para colocar el pin
     - Radio de llegada en metros (para ControlZone automática)
     - Notas opcionales

5. MÓDULO DE RECORRIDOS (/routes)

   CONCEPTO CENTRAL:
   Un Recorrido es una ruta pre-definida y reutilizable.
   Se define UNA VEZ y se usa en MUCHOS viajes.
   Jerarquía en UI: por Cliente (operation) → Recorridos de ese cliente.

   Endpoints:
   GET    /api/v1/routes                    ← lista, filtrable por operation_id
   GET    /api/v1/routes/{id}
   POST   /api/v1/routes
   PUT    /api/v1/routes/{id}
   DELETE /api/v1/routes/{id}
   PATCH  /api/v1/routes/{id}/toggle
   GET    /api/v1/routes/{id}/trips         ← todos los viajes que usaron este recorrido
   GET    /api/v1/routes/by-operation/{operationId} ← recorridos de un cliente

   FRONTEND — RoutesPage (/routes):
   Layout: árbol izquierdo + mapa derecho.

   Árbol izquierdo (agrupado por cliente):
   ┌─────────────────────────────┐
   │ 🔍 Buscar recorridos...      │
   │ ─────────────────────────── │
   │ ▼ Cliente: LogiSur SA        │
   │   📍 Rosario → Córdoba Ruta9 │
   │   📍 Córdoba → Mendoza       │
   │   📍 Rosario → Buenos Aires  │
   │ ▼ Cliente: TransNorte SRL    │
   │   📍 Tucumán → Salta         │
   │   📍 Jujuy → Mendoza         │
   │ ▼ Sin cliente (genéricos)    │
   │   📍 Ruta estándar Puerto    │
   └─────────────────────────────┘

   Click en recorrido → mapa muestra la ruta con:
     - LineString del recorrido (verde = C.mapRoutePlanned)
     - Marcador de origen (pin verde)
     - Marcador de destino (pin rojo)
     - Marcadores de waypoints intermedios (pin ámbar)
     - Distancia y tiempo estimado en overlay sobre el mapa
     - Panel derecho con detalles: corridor_meters, veces usado, último uso

   Botón "Nuevo recorrido":
   Paso 1 — Asignar a cliente (selector operation_id, opcional)
   Paso 2 — Nombre del recorrido
   Paso 3 — Seleccionar origen (dropdown de saved_locations o click en mapa)
   Paso 4 — Seleccionar destino (dropdown de saved_locations o click en mapa)
   Paso 5 — Dibujar el trayecto:
     OPCIÓN A: "Usar ruta sugerida" → OSRM (OpenStreetMap Routing Machine) calcula la ruta más corta
     OPCIÓN B: "Dibujar manualmente" → herramienta de dibujo MapLibre Draw (@mapbox/mapbox-gl-draw)
     En ambos casos: se puede editar el trayecto resultante antes de guardar
   Paso 6 — Waypoints opcionales (checkpoints intermedios, desde saved_locations)
   Paso 7 — Corredor de tolerancia (slider: 200m → 2000m, default 500m)
   Paso 8 — Guardar → INSERT en routes, crear ControlZones automáticamente
     para origen y destino si tienen radio configurado

   KML IMPORT:
   Botón "Importar KML" en RoutesPage.
   
   ADVERTENCIA visible en el panel antes del botón:
   "⚠️ Solo se aceptan geometrías LineString. Puntos y polígonos serán ignorados."
   
   Proceso:
   a) Parsear KML con @tmcw/togeojson → convertir a GeoJSON
   b) Extraer todas las geometrías del tipo LineString
   c) Si hay exactamente 1 LineString: usar directamente
   d) Si hay 0 LineString: mostrar error "El archivo no contiene rutas válidas"
   e) Si hay múltiples LineString: mostrar selector al operador:
      ┌─────────────────────────────────────────┐
      │ 📂 El archivo contiene 3 rutas          │
      │ Seleccioná cuál importar:               │
      │                                         │
      │ ○ Ruta 1 — 245.3 km (previsualizar)    │
      │ ○ Ruta 2 — 182.1 km (previsualizar)    │
      │ ○ Ruta 3 — 67.8 km  (previsualizar)    │
      │              [Cancelar] [Importar →]    │
      └─────────────────────────────────────────┘
      Al hover "previsualizar": muestra la LineString en el mapa del modal
   f) LineString seleccionada → iniciar wizard de creación desde Paso 1
      con la geometría pre-cargada (editable antes de guardar)

   KML EXPORT:
   Botón "Exportar KML" en cada recorrido + export masivo por país.
   
   Exportar un recorrido:
   - Generar KML con: nombre, descripción, geometry (LineString)
   - Incluir metadata en ExtendedData: corridor_meters, distance_km, times_used
   - Nombre de archivo: {route.name}_{country_code}.kml
   
   Exportar por país (KML masivo):
   GET /api/v1/routes/export/kml?country=AR
   - Incluye todos los recorridos activos del tenant con ese country_code
   - Un Placemark por recorrido dentro del mismo KML
   - Agrupado por cliente (Folder por operation_id)
   - Útil para migrar configuraciones entre entornos o tenants

   KML EXPORT también aplica a:
   GET /api/v1/geofences/export/kml?country=AR   → todas las geocercas del país
   GET /api/v1/trips/{id}/export/kml             → recorrido real del viaje histórico
   (ya existente en endpoints)

   DETECCIÓN DE RECORRIDOS SIMILARES:
   Al guardar un recorrido nuevo (INSERT en routes), ejecutar en background
   (BullMQ job de baja prioridad, no bloquea la respuesta):

   Consulta PostGIS:
   SELECT id, name, operation_id FROM routes
   WHERE tenant_id = currentTenant
   AND is_active = true
   AND id != nuevoRouteId
   AND ST_DWithin(
     (SELECT geometry FROM saved_locations WHERE id = nuevoRoute.origin_location_id),
     (SELECT geometry FROM saved_locations WHERE id = r.origin_location_id),
     {route_similarity_radius_meters}  ← desde ParameterSettings, default 500
   )
   AND ST_DWithin(
     (SELECT geometry FROM saved_locations WHERE id = nuevoRoute.destination_location_id),
     (SELECT geometry FROM saved_locations WHERE id = r.destination_location_id),
     {route_similarity_radius_meters}
   )

   Si encuentra coincidencias:
   → Emitir Socket.io: 'route:similarity_detected' al manager+ del tenant
   → Notificación en UI (toast no bloqueante):
     "El recorrido 'Rosario → Córdoba' es similar a 'Ruta 9 — LogiSur SA'.
      ¿Querés vincularlos o mantenerlos independientes?"
   → "Vincular": ambos recorridos comparten geometría de referencia,
     cada uno mantiene su corridor, waypoints y cliente propios
   → "Independientes": descartar la sugerencia, no hacer nada

   FILTRO POR PAÍS en RoutesPage:
   Selector de país en el header del árbol izquierdo.
   Default: país del tenant (settings_json.default_country).
   "Todos los países" disponible para ver flota completa multi-país.

   POST /api/v1/vehicles/import — BULK IMPORT
   Auth: JWT (manager+ o rusertech_admin)
   Content-Type: multipart/form-data (archivo CSV o XLSX)
   Body: archivo + { avlUserId: UUID } (obligatorio — todos los vehículos del import se asocian al mismo avl_user)
   
   Proceso:
   a) Parsear archivo (CSV con papaparse o XLSX con exceljs)
   b) Validar columnas obligatorias: plate, hub_asset_id
      Columnas opcionales: alias, brand, model, year, vehicle_type, fuel_type, fuel_efficiency_lper100km
   c) Para cada fila:
      - Verificar plate no duplicada en el tenant
      - Verificar hub_asset_id no duplicado para ese avl_user
      - Si pasa: INSERT vehicle
      - Si falla: agregar a lista de errores con número de fila y motivo
   d) Retornar:
      {
        total: N,
        imported: N,
        failed: N,
        errors: [{ row: 5, plate: "ABC123", reason: "Patente duplicada" }]
      }
   
   GET /api/v1/vehicles/import/template
   → Descarga plantilla CSV/XLSX con las columnas correctas y datos de ejemplo
   → El template incluye una fila de ejemplo con datos reales para guiar al cliente

   FRONTEND — ImportVehiclesModal (en VehicleListPage):
   Botón "Importar flota" junto al botón "Nuevo vehículo"
   
   Paso 1: Selector de AVL User (dropdown — obligatorio)
   Paso 2: Drag & drop de archivo CSV o XLSX
           Link "Descargar plantilla" bien visible
   Paso 3: Preview de las primeras 5 filas del archivo (tabla)
           Indicador: "X vehículos detectados"
   Paso 4 (post-import): Reporte de resultados
           ✅ "127 vehículos importados correctamente"
           ❌ "3 errores — descargar log de errores (XLSX)"
           El XLSX de errores tiene: fila, patente, motivo del error

   GET /live: No toca PostgreSQL. Lee solo Redis.
   Para cada vehicleId del tenant (desde Redis SET vehicle:ids:{tenantId}):
     GET vehicle:position:{vehicleId}
   Retorna array con posición + estado de cada vehículo.
   Respuesta esperada < 50ms.

   Al crear vehículo: SADD vehicle:ids:{tenantId} {vehicleId}

2. MÓDULO DRIVERS:
   GET  /api/v1/drivers
   GET  /api/v1/drivers/available     → sin viaje in_progress hoy
   GET  /api/v1/drivers/{id}
   POST /api/v1/drivers
   PUT  /api/v1/drivers/{id}
   DELETE /api/v1/drivers/{id}        → soft delete

3. MÓDULO OPERATIONS:
   CRUD básico: GET, POST, PUT, DELETE /api/v1/operations

4. MÓDULO GEOFENCES:

   Endpoints:
   GET    /api/v1/geofences              → lista, retorna geometry como GeoJSON
   GET    /api/v1/geofences/{id}
   POST   /api/v1/geofences/polygon      → array de [lng,lat] pairs
   POST   /api/v1/geofences/circle       → { centerLat, centerLng, radiusMeters }
   POST   /api/v1/geofences/corridor     → { routeGeojson (LineString), widthMeters }
   PUT    /api/v1/geofences/{id}
   DELETE /api/v1/geofences/{id}
   PATCH  /api/v1/geofences/{id}/toggle  → activar/desactivar (SWITCH)
   POST   /api/v1/geofences/check-point  → { lat, lng } → retorna geocercas que contienen ese punto
   GET    /api/v1/geofences/{id}/export/geojson
   GET    /api/v1/geofences/{id}/export/kml

   Tipos de zona (zone_type):
   - geofence: geocerca estándar (entrada/salida dispara evento)
   - route_corridor: corredor de ruta (vehículo debe mantenerse dentro)
   - danger_zone: zona de peligro (alerta inmediata al entrar)
   - alert_zone: zona de alerta configurable
   - restricted_zone: zona restringida (alerta crítica)
   
   Cada tipo tiene color diferente en mapa (del Design System)

   PostGIS para check-point:
   SELECT id, name, zone_type FROM geofences
   WHERE ST_Within(
     ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography::geometry,
     geometry::geometry
   ) AND tenant_id = current_tenant AND is_active = true

   Export GeoJSON: SELECT ST_AsGeoJSON(geometry) FROM geofences WHERE id=...
   Export KML: construir XML KML manualmente desde los datos de la geometría

5. FRONTEND — GESTIÓN DE FLOTA (/fleet):
   
   VehicleListPage:
   - Tabla con búsqueda por placa/alias, filtro por tipo/estado
   - Columna "Estado" con badge colored: activo/bloqueado/inactivo/sin señal
   - Columna "Señal" con tiempo desde última posición (verde<5min, amarillo<30min, rojo>30min)
   - SWITCH de bloqueo directamente en cada fila con confirmación modal
   - Al activar bloqueo: pedir motivo (textarea, opcional)
   - Click en vehículo → panel lateral con detalle + última posición en mini-mapa

6. FRONTEND — GESTIÓN DE GEOCERCAS (/geofences):
   
   GeofenceListPage:
   - Tabla con miniatura del polígono, tipo, estado
   - SWITCH de activar/desactivar por geocerca
   - Botones export GeoJSON / KML
   
   GeofenceMapEditor (MapLibre + @mapbox/mapbox-gl-draw):
   - Mapa oscuro (dark-v11) a pantalla completa
   - Panel izquierdo: lista de zonas por tipo con toggle de visibilidad
   - Cada tipo de zona tiene su color del Design System
   - Herramientas de dibujo (toolbar superior):
     🔷 Polígono: click para vértices, doble-click para cerrar
     ⭕ Círculo: click centro, arrastrar para radio
     〰️ Corredor: dibujar LineString, definir ancho en metros con slider
     🚧 Zona Peligrosa: polígono rojo con fill rojo semitransparente
     ⚠️ Zona de Alerta: polígono ámbar
   - Al completar dibujo: formulario lateral: nombre, descripción, tipo, color picker
   - Edición: click en zona → handles de vértices editables

7. CHECKLIST:
   □ SWITCH de bloqueo en vehículo: próxima ingesta del HUB es descartada silenciosamente
   □ GET /vehicles/live responde < 50ms con datos de Redis
   □ Crear polígono geocerca → aparece en mapa con color correcto
   □ POST /geofences/check-point con punto dentro del polígono → retorna la geocerca
   □ Export GeoJSON → válido en geojson.io
   □ Zona peligrosa en mapa aparece en rojo con fill rojo semitransparente
```

---

### 🔨 BLOQUE 4 — VIAJES Y MONITOREO EN TIEMPO REAL
**Objetivo:** Ciclo completo de viaje. Desvío calculado. Socket.io en vivo.
**Tiempo estimado:** 4-5 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 4
═══════════════════════════════════════════════════════

Continuamos. Bloques 0-3 completos.
Construir el módulo de viajes y el hub de tiempo real.

1. TRIPS MODULE — CQRS con @nestjs/cqrs:

   Comandos:
   CreateTripCommand → status: draft
     Validar: vehicleId del tenant, plannedStart < plannedEnd,
     no hay trip in_progress para ese vehículo.

     SELECCIÓN DE RECORRIDO (dos caminos):
     A) Recorrido pre-existente: body incluye route_id
        → plannedRouteGeoJson se copia desde routes.geometry
        → corridor_meters se copia desde routes.corridor_meters
        → ControlZones de origen/destino del recorrido se asignan al viaje
        → UPDATE routes SET times_used++, last_used_at=NOW()
     B) Ruta nueva: body incluye plannedRouteGeoJson dibujada en el momento
        → se guarda en el viaje sin route_id
        → se puede guardar como nuevo recorrido al finalizar el viaje

     FRONTEND — CreateTripModal (wizard):
     Paso 1 — Vehículo + Conductor + Operación (cliente)

       SELECTOR DE VEHÍCULO (Regla 36 — IMPORTANTE):
       Muestra todos los vehículos activos del tenant.
       Para cada vehículo: indicar tiempo desde última señal.
         · "Hace 2 min" en verde → señal reciente
         · "Hace 45 min" en ámbar → señal desactualizada
         · Badge "Sin señal reciente" en gris → no hay dato en Redis
       El badge "Sin señal reciente" NO bloquea la selección.
       Cualquier vehículo activo puede asignarse al viaje.
       El viaje se crea aunque el vehículo no tenga señal reciente —
       cuando el HUB envíe datos, el pipeline los asocia automáticamente.

     Paso 2 — SELECCIONAR RECORRIDO:
       Dos tabs:
       [📋 Recorrido existente] → lista filtrada por operation_id seleccionado
         Buscador + lista de recorridos del cliente
         Preview del recorrido en mapa al hover
         Click → seleccionar y continuar
       [✏️ Dibujar nuevo] → herramienta MapLibre Draw en modal
         Origen y destino desde saved_locations o click en mapa
     Paso 3 — Fechas y horarios + criticality + sensibilidad de riesgo
     Paso 4 — Confirmar con pre-trip validation (warnings geoespaciales)

   PRE-TRIP ROUTE VALIDATION (Regla 27 — advertencia, nunca bloqueo):
   Se ejecuta en ScheduleTripCommand (draft → scheduled) cuando hay plannedRouteGeoJson.
   PostGIS evalúa si la ruta intersecta con zonas problemáticas:

   a) DANGER ZONES:
      SELECT id, name FROM geofences
      WHERE zone_type='danger_zone' AND is_active=true
      AND ST_Intersects(ST_GeomFromGeoJSON(plannedRoute), geometry)
      → Si hay intersección: warning 'route_crosses_danger_zone'

   b) NO SIGNAL ZONES:
      SELECT id, name, signal_loss_reason, expected_loss_minutes
      FROM no_signal_zones WHERE is_active=true
      AND (tenant_id=currentTenant OR tenant_id IS NULL)
      AND ST_Intersects(ST_GeomFromGeoJSON(plannedRoute), geometry)
      → Si hay intersección: warning 'route_crosses_no_signal_zone'
      → Incluir nombre, razón y duración esperada por zona

   c) RESTRICTED ZONES:
      SELECT id, name FROM geofences
      WHERE zone_type='restricted_zone' AND is_active=true
      AND ST_Intersects(ST_GeomFromGeoJSON(plannedRoute), geometry)
      → Si hay intersección: warning 'route_crosses_restricted_zone'

   Resultado: { warnings: [ { type, zoneId, zoneName, severity, message } ] }
   Las warnings se guardan en trip.metadata_json.route_warnings para referencia.
   El operador puede reconocerlas y confirmar, o redibujar la ruta.
   El viaje se crea aunque haya warnings (advertencia, no bloqueo).

   FRONTEND — ScheduleTripModal:
   Si la validación retorna warnings: mostrar modal de confirmación:
   - Header: "⚠️ La ruta planificada tiene conflictos"
   - Mapa con la ruta y los segmentos problemáticos resaltados:
     Rojo = danger_zone / Gris rayado = no_signal_zone / Violeta = restricted_zone
   - Lista de conflictos con descripción:
     "🔴 La ruta cruza la Zona de Peligro: Acceso Puerto Norte (Km 12 - Km 15)"
     "⬛ La ruta cruza zona sin señal: Túnel Ruta 38 (~8 min sin cobertura)"
   - Botones: "Reconocer y continuar" | "Volver a redibujar"
   Si reconoce: INSERT trip_command_history (type='route_warnings_acknowledged', new_value={warnings})
   
   ScheduleTripCommand → draft → scheduled
     Validar: tiene plannedRouteGeoJson si reinforcedMonitoring=true
   
   StartTripCommand → scheduled → in_progress
     SET actual_start = NOW()
     SET Redis: trip:active:{vehicleId} = tripId (TTL: 48h)
     Notificar via Socket.io: canal tenant/{tenantId}

   CompleteTripCommand → in_progress → completed
     SET actual_end = NOW()
     DEL Redis: trip:active:{vehicleId}
     Publicar job en BullMQ 'carbon.calculate' con { tripId, vehicleId, tenantId }
   
   CancelTripCommand → cualquier estado → cancelled (motivo obligatorio)
   UpdateTripRouteCommand → solo draft/scheduled
   AcknowledgeDeviationCommand → operator reconoce, agrega nota

   COMANDOS MID-TRIP (con viaje in_progress — SIMON mejorado):
   Permiten modificar un viaje en curso sin cancelarlo.
   Cada uno genera registro automático en trip_command_history.

   ChangeVehicleMidTripCommand: { newVehicleId, reason }
   - Validar: newVehicleId del tenant, activo, sin otro trip in_progress
   - UPDATE trips SET vehicle_id=new, vehicle_changes_count++
   - INSERT trip_command_history (type='vehicle_changed', prev+new values, reason)
   - Redis: DEL trip:active:{oldVehicleId} / SET trip:active:{newVehicleId}={tripId}
   - Emit Socket.io: 'trip:vehicle_changed'

   ChangeDriverMidTripCommand: { newDriverId, reason }
   - UPDATE trips SET driver_id=new, driver_changes_count++
   - INSERT trip_command_history (type='driver_changed', prev+new values, reason)
   - Emit Socket.io: 'trip:driver_changed'

   AddManualNoteToTripCommand: { note }
   - INSERT trip_command_history (type='manual_note', is_automatic=false)

   AUDIT LOG INTERCEPTOR (global — aplica a TODOS los comandos del sistema):
   NestJS AuditLogInterceptor aplicado globalmente:
   - Se ejecuta DESPUÉS de cada comando/mutation exitosa
   - Lee: userId, role, ip del request context
   - Detecta: entityType y entityId del comando
   - Compara estado antes/después y extrae changed_fields
   - INSERT audit_log automáticamente
   El handler individual no necesita código de auditoría — el interceptor lo hace solo.

2. DEVIATION MONITOR + CONTROL ZONE MONITOR (BullMQ Consumer de 'telemetry.raw'):

   Para cada punto GPS:
   a) GET Redis: trip:active:{vehicleId} → tripId
   b) Si no hay tripId activo → saltar
   c) Obtener plannedRouteGeoJson del trip desde DB (cache en Redis 5min)

   DESVÍO DE RUTA:
   d) Si hay ruta planificada → calcular desvío con PostGIS:
      SELECT ST_Distance(currentPoint, ST_GeomFromGeoJSON(routeGeojson)) as meters
   e) Si meters > corridor_meters:
      - INSERT trip_deviations (incluir deviation_segment_geojson)
      - Si trip.status != 'deviated': UPDATE status='deviated'
      - Publicar en BullMQ 'events.triggered': { type:'route_deviation', tripId, meters }
      - Emit Socket.io: canal trip/{tripId}: 'deviation:detected' { meters, lat, lng }

   ETA:
   f) distanciaRestante = ST_Distance(currentPoint, destination)
      velocidadPromedio = AVG últimas posiciones de Redis
      eta = NOW() + (distanciaRestante / velocidadPromedio)
      Emit Socket.io: 'eta:updated' { eta, distanceRemainingKm }

   CONTROL ZONES (evaluar en el mismo consumer, después del desvío):
   g) Para cada control_zone del trip (desde trip_control_zones):
      Verificar ST_Within(currentPoint, control_zone.geometry)
      Comparar con Redis: GET controlzone:status:{tripId}:{zoneId}

      Si ENTRÓ a zona 'origin' y trip.status='scheduled':
        auto_transition=true  → StartTripCommand automático
        auto_transition=false → Emit 'trip:ready_to_start' + notificación operador

      Si ENTRÓ a zona 'destination' y trip.status='in_progress':
        auto_transition=true  → CompleteTripCommand automático (configuración por CLIENTE)
        auto_transition=false → Emit 'trip:arrived_at_destination' + confirmación manual

      Si ENTRÓ a zona 'waypoint':
        → Marcar was_triggered=true, INSERT trip_events(type='waypoint_reached')

      Si ENTRÓ a zona 'checkpoint':
        → UPDATE trip.status='at_checkpoint'
        → Activar AlarmTypeExclusions con trip_status_filter='at_checkpoint'

      Si viaje avanza sin pasar waypoint obligatorio:
        → event_log(type='waypoint_skipped', severity='warning')

      SET Redis: controlzone:status:{tripId}:{zoneId} 'inside'|'outside' TTL: 48h

3. SOCKET.IO HUB (NestJS Gateway):

   Namespace: /tracking
   
   Al conectar: validar JWT en handshake query param `token`
   Extraer tenantId, userId, role del JWT
   
   Join automático al grupo: tenant:{tenantId}
   
   Eventos que escucha del cliente:
   - 'trip:subscribe'   → join a grupo trip:{tripId}  (verificar que el trip es del tenant)
   - 'trip:unsubscribe' → leave grupo trip:{tripId}
   - 'vehicle:subscribe'→ join a grupo vehicle:{vehicleId}
   - 'positions:request'→ responder con todas las posiciones de Redis del tenant

   Eventos que emite al cliente:
   - 'vehicle:position'   → nueva posición GPS
   - 'alert:new'          → nueva alerta disparada
   - 'trip:status'        → cambio de estado del viaje
   - 'deviation:detected' → desvío detectado con metros y segmento
   - 'eta:updated'        → ETA recalculado
   - 'temperature:alert'  → temperatura fuera de rango
   - 'humidity:alert'     → humedad fuera de rango

   BACKPRESSURE (para miles de vehículos):
   VehiclePositionBuffer: Map<vehicleId, PositionData>
   Timer cada 500ms: emit batch a tenant:{tenantId} con posiciones del buffer
   El consumer de telemetry.raw solo actualiza el buffer, no emite directo

4. TRIP QUERIES:
   GetTripByIdQuery: detalle + puntos GPS + desviaciones + timeline + ETA + sensores actuales
   GetTripsPageQuery: paginación con filtros (status, vehicleId, dateRange, userId creador)
   GetActiveTripsDashboard: solo in_progress del tenant, mezcla DB + Redis

5. FRONTEND — TRIPS MODULE:

   /trips — TripListPage:
   - Tabla con filtros: status multi-select, vehículo, fecha, operación
   - Row color según status: verde=in_progress, amarillo=deviated, rojo=at_risk
   - Columna "Creado por" (importante: external_client puede ver sus propios viajes)
   - FAB con gradiente acento: "Declarar Viaje"
   - External Viewer no ve este botón

   CreateTripFlow (wizard 4 pasos — implementado en Bloque 6 / CreateTripModal):
   Paso 1: Vehículo + Conductor + Operación
           (badge "Sin señal reciente" informativo — no bloquea la selección — Regla 36)
   Paso 2: Seleccionar Recorrido (existente o dibujar nuevo con MapLibre Draw)
   Paso 3: Fechas, criticidad, sensibilidad de riesgo, monitoreo reforzado toggle
   Paso 4: Confirmar con pre-trip validation (warnings geoespaciales — Regla 27)

   /trips/{id} — TripDetailPage:
   Split 60/40: mapa izquierda, info derecha
   MAPA: ruta planificada (verde), recorrido real (blanco), desviados (rojo)
   INFO: status badge animado si in_progress, métricas en vivo via Socket.io,
         timeline de eventos, desviaciones, temperatura sparkline, humedad sparkline
   
   /command-center:
   Grid de cards de viajes in_progress
   Cada card actualizada via Socket.io
   Alertas abiertas en panel lateral
   Mapa global con todos los viajes

6. FRONTEND — HOOK useSocket:
   Conexión Socket.io con reconexión automática (backoff exponencial: 2,4,8,16,32s)
   Al reconectar: emit 'positions:request' para sincronizar
   Actualiza Zustand stores con datos recibidos
   Indicador de conexión en topbar: 🟢 conectado / 🟡 reconectando / 🔴 desconectado

7. CHECKLIST:
   □ Declarar viaje en 4 pasos → status: draft en DB
   □ Crear viaje con vehículo sin señal reciente → viaje se crea OK (Regla 36)
   □ Cuando HUB envía primer dato → marcador aparece en mapa del viaje
   □ Selector vehículo muestra badge "Sin señal reciente" pero permite seleccionar
   □ StartTrip → Redis trip:active:{vehicleId} = tripId
   □ Enviar GPS que sale de la ruta → desvío en Socket.io en < 2 segundos
   □ ETA se actualiza con cada punto GPS
   □ Socket.io: 2 clientes del mismo tenant reciben mismo update
   □ External Client solo ve sus propios viajes en la lista
   □ Backpressure: 100 GPS/segundo → cliente recibe 2 batches/segundo máximo
   □ TripQueryFilterDto: GET /trips?travelStatuses[]=in_progress → filtra OK
```

---

### 🔨 BLOQUE 5 — MOTOR DE EVENTOS Y ALERTAS
**Objetivo:** Reglas configurables con switch. Notificaciones automáticas. Panel de alertas.
**Tiempo estimado:** 4-5 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 5
═══════════════════════════════════════════════════════

Continuamos. Bloques 0-4 completos.
Construir el Motor de Eventos configurable de Rusertech.

FILOSOFÍA DE DISEÑO:
Cada alerta tiene un SWITCH on/off. La UI debe reflejar esto con toggles simples.
El operador no debe necesitar conocimientos técnicos para activar/desactivar una alerta.
Si un código del prestador llega y no tiene regla asociada, no genera alerta.
Solo genera alerta si hay una event_rule activa que lo capture.

1. EVENT ENGINE (BullMQ Consumer de 'telemetry.raw'):

   Para cada punto GPS normalizado, evaluar en orden de prioridad:
   1º Reglas scope_type='trip' AND scope_id=tripActivo
   2º Reglas scope_type='vehicle' AND scope_id=vehicleId
   3º Reglas scope_type='operation' AND scope_id=operationId
   4º Reglas scope_type='global_tenant'
   
   Las reglas del external_client solo aplican a sus propios trips.
   
   EVALUADORES:

   speed_exceeded:
     Condición: speedKmh > threshold_max (o < threshold_min si se configura)
     Timer: Redis INCR speed:timer:{vehicleId} EX duration_seconds
     Disparar cuando timer >= duration_seconds
     Reset timer si vuelve al rango

   idle:
     Condición: speedKmh === 0 AND ignition === true
     Timer: Redis idle:timer:{vehicleId}
     Disparar al superar duration_seconds

   geofence_enter / geofence_exit:
     Para cada geofence activa del tenant:
       Consulta PostGIS: ST_Within(punto, geometry)
     Comparar con estado previo: GET Redis geofence:status:{vehicleId}:{geofenceId}
     Si cambia fuera→dentro: geofence_enter
     Si cambia dentro→fuera: geofence_exit
     SET Redis con nuevo estado EX 3600

   danger_zone_enter:
     Igual que geofence, pero zone_type='danger_zone'
     Severidad automática: 'critical' sin importar la configuración

   route_deviation:
     Calculado por DeviationMonitor (Bloque 4). El engine solo reacciona.

   unauthorized_stop:
     speed===0 AND ignition===false AND NOT dentro de geofence autorizada
     Timer: stop:timer:{vehicleId}

   signal_loss:
     No es un evento del stream. Es un CRON cada 60 segundos:
     Para cada vehicleId activo del tenant:
       Verificar TTL de Redis vehicle:position:{vehicleId}
       Si TTL < 0 (key expirada): generar evento signal_loss
       
       ENRIQUECIMIENTO CON CONTEXTO (Regla 25 — NO suprimir, informar):
       Consultar PostGIS: ¿la última posición conocida está dentro de alguna no_signal_zone?
         SELECT id, name, signal_loss_reason, expected_loss_minutes
         FROM no_signal_zones
         WHERE ST_Within(lastKnownPoint, geometry) AND is_active=true
         AND (tenant_id=currentTenant OR tenant_id IS NULL)  ← incluye zonas globales
       
       Si está en zona muerta conocida:
         → Generar la alerta signal_loss IGUAL (no suprimir, Regla 25)
         → Agregar al event_log: no_signal_zone_id = zona.id
         → Agregar al metadata_json: { zoneName, reason, expectedMinutes }
         → En la notificación al operador incluir contexto:
           "⚠️ Pérdida de señal — ABC 123
            📍 Última posición: Ruta 38 Km 45, Córdoba
            ℹ️ Zona muerta conocida: Túnel Km 45 (causa: túnel)
            ⏱️ Duración esperada: ~8 minutos
            El vehículo puede reaparecer. Mantener monitoreo activo."
         → RiskLevel: factor signal_loss aplica igual (30 pts)
           EXCEPTO si la zona es de alta peligrosidad (danger_zone superpuesta):
           en ese caso usar signal_loss_high_risk_zone (50 pts) igual que siempre
       
       Si NO está en zona muerta conocida:
         → Alerta signal_loss estándar sin contexto adicional
     
   ignition_on / ignition_off:
     Comparar ignition actual con Redis ignition:prev:{vehicleId}
     Si cambia: disparar evento. Actualizar Redis.

   temperature_out_of_range:
     Buscar sensor_config aplicable (scope más específico primero)
     Si temperatura < value_min OR temperatura > value_max:
       Timer: temp:timer:{vehicleId} 
     Incluir sensor_type='temperature'

   temperature_spike:
     |temperatureC_now - GET Redis temp:prev:{vehicleId}| > spike_delta
     Disparar inmediatamente sin timer

   humidity_out_of_range / humidity_spike:
     Mismo tratamiento que temperatura. sensor_type='humidity'

   battery_low:
     batteryPct < threshold_min (ej: 20%)
     Solo si la regla está activa (SWITCH)

   odometer_threshold:
     odometerKm >= threshold_max
     Solo si la regla está activa (SWITCH)

   provider_code_event:
     Si eventType del punto matchea provider_code_filter de la regla
     Y el código tiene triggers_alert=true en el diccionario
     Disparar alerta

   trip_delayed:
     Evaluado en cada update de ETA: ETA > planned_end
     Generar alerta si no hay una ya abierta de este tipo para el trip

2. CUANDO SE DISPARA UN EVENTO — FLUJO COMPLETO (AlarmChronic + AlarmTypeExclusion):

   Inspirado en AlarmDomainService.cs de SIMON — mejorado y más inteligente.
   
   PASO A — SIEMPRE registrar en event_logs (NUNCA omitir):
   INSERT event_logs → el historial es siempre completo, sin importar exclusiones ni grouping

   PASO A2 — ALARM GROUPING (Regla 26 — evaluar antes de notificar):
   Si la regla tiene groupable_distance_meters o groupable_time_seconds configurado:
   
     Buscar en event_logs: ¿existe una alerta del mismo tipo para este vehículo
     en los últimos groupable_time_seconds Y/O a menos de groupable_distance_meters?
     
     Si existe alerta reciente/cercana:
       → Esta ocurrencia ES parte del grupo. NO se notifica individualmente.
       → UPDATE del event_log del grupo: grouped_count++
       → El operador ya fue notificado del grupo — no se le vuelve a molestar
       → Sí se registra en alarm_chronic_queue con occurrence_count++ (trazabilidad completa)
       → Sí se actualiza RiskLevel si aplica (el score no se agrupa, cada factor cuenta)
     
     Si NO existe alerta reciente/cercana:
       → Es el inicio de un nuevo grupo. Notificar normalmente.
       → event_log.grouped_count = 1 (inicio del grupo)
       → Continuar a PASO B normalmente.
   
   NOTA: El agrupamiento afecta SOLO a la notificación externa (email/push/whatsapp/webhook).
   event_logs y alarm_chronic_queue registran TODO, siempre, sin excepción.

   PASO B — SIEMPRE registrar en alarm_chronic_queue:
   Buscar event_log abierto del mismo tipo para el mismo vehículo (aún no resuelto)
   Si existe → es alerta crónica. INSERT alarm_chronic_queue con:
     parent_event_id = id del event_log original
     occurrence_count = número consecutivo de esta ocurrencia
     measured_value = valor medido en este punto (ej: velocidad=120 km/h)
   Si no existe → evento nuevo original. Continuar normalmente.

   PASO C — Evaluar exclusiones activas (AlarmTypeExclusion):
   Buscar en alarm_exclusions WHERE is_active=true AND aplica a este contexto:
     Verificar: event_type match, scope match (tenant/vehicle/trip/geofence)
     Verificar: franja horaria (time_from/time_to) y día de semana si configurados
     Verificar: si geofence_id está seteada → ST_Within(posición, geocerca)
   
   Si hay exclusión aplicable → según exclusion_action:
     'suppress_notification'  → NO notificar. Guardar exclusion_id en chronic_queue.
     'downgrade_severity'     → Bajar severity (critical→warning / warning→info). Continuar.
     'add_to_chronic_queue'   → Ir a cola de crónicas. NO notificar ahora.
   
   REGLA: event_logs y alarm_chronic_queue se crean SIEMPRE en pasos A y B.
   La exclusión solo afecta la NOTIFICACIÓN. El historial es siempre 100% completo.

   PASO D — Notificar (solo si ninguna exclusión lo suprimió):
   Si hay trip activo: INSERT trip_events (timeline del viaje)
   Publicar en BullMQ 'events.triggered': payload completo
   Emit Socket.io al canal tenant/{tenantId}: 'alert:new' { alerta }
   UPDATE event_logs SET was_notified=true

3a. RISK LEVEL ENGINE — Motor de Riesgo Dinámico del Viaje

   CONCEPTO CENTRAL:
   RiskLevel NO es la severidad de una alerta individual.
   Es el estado de riesgo ACUMULADO del viaje completo, calculado por scoring.
   El operador ve de un vistazo: "Este viaje está en riesgo ALTO" — no solo alertas sueltas.
   Inspirado en SIMON RiskLevel — superado con scoring contextual y decay automático.

   TABLA DE FACTORES Y PUNTOS (configurable via ParameterSettings):

   | Factor                          | Puntos base | Nota                              |
   |---------------------------------|-------------|-----------------------------------|
   | signal_loss                     | +30         | Pérdida total de señal GPS        |
   | signal_loss_high_risk_zone      | +50         | Sin señal DENTRO de zona peligrosa|
   | route_deviation_minor           | +10         | Desvío 1-2x el corredor           |
   | route_deviation_major           | +25         | Desvío >2x el corredor            |
   | unacknowledged_critical_alert   | +20         | Alerta crítica sin reconocer      |
   | unacknowledged_warning_alert    | +10         | Alerta warning sin reconocer      |
   | speed_exceeded_sustained        | +15         | Velocidad alta por >5 min         |
   | unauthorized_stop               | +20         | Parada sin justificación          |
   | temperature_out_of_range        | +15         | Sensor fuera de rango             |
   | trip_delayed_moderate           | +10         | >30 min de retraso sobre ETA      |
   | trip_delayed_severe             | +20         | >60 min de retraso sobre ETA      |
   | danger_zone_entered             | +35         | Vehículo en zona de peligro       |
   | provider_sos_code               | +60         | Código SOS del dispositivo GPS    |
   | multiple_concurrent_alerts      | +15         | 3+ alertas abiertas simultáneas   |

   NIVELES Y COLORES (thresholds configurables via ParameterSettings):
   🟢 normal   → Score 0-24    → Color: Colors.statusOnline
   🟡 elevated → Score 25-49   → Color: Colors.statusWarning (pulsante leve)
   🟠 high     → Score 50-74   → Color: #F97316 (naranja — intermedio entre ámbar y rojo)
   🔴 critical → Score 75+     → Color: Colors.statusDanger (pulsante agresivo)

   DECAY AUTOMÁTICO (el riesgo baja si se tratan las alertas):
   Cada hora que pasa sin nuevos factores negativos: score -= risk_decay_rate_per_hour (default: 10)
   Al reconocer una alerta: quitar sus puntos del score inmediatamente
   Al resolver una alerta: quitar sus puntos + decay bonus -5 adicionales

   CÁLCULO EN TIEMPO REAL (BullMQ Consumer de 'telemetry.raw' — después del EventEngine):

   Para cada punto GPS con viaje activo:
   a) Recuperar trip_risk_levels actual del viaje (Redis cache)
   b) Recalcular score sumando todos los active_factors vigentes
   c) Aplicar decay si corresponde
   d) Determinar nuevo nivel según thresholds
   e) Si el nivel CAMBIÓ:
      - UPDATE trip_risk_levels (score, level, active_factors, level_changed_at)
      - INSERT trip_risk_history
      - UPDATE trip status si corresponde:
          elevated/high → status='at_risk'
          critical → status='at_risk' + alerta inmediata de máxima prioridad
      - Emit Socket.io: 'risk:level_changed' { tripId, from, to, score, factors }
      - Si subió a critical: NotificationService envía alerta de emergencia

   REDIS CACHE del risk level:
   SET trip:risk:{tripId} { level, score, factors, updatedAt } TTL: trip duration

   EVALUACIÓN DE FACTORES COMPUESTOS (más inteligente que SIMON):
   El sistema detecta combinaciones peligrosas y aplica multiplicador:
   - signal_loss + danger_zone_entered simultáneos → score * 1.5
   - route_deviation + unauthorized_stop simultáneos → score * 1.3
   - provider_sos_code → escala directo a critical sin importar score previo

   CONFIGURACIÓN POR VIAJE:
   En CreateTripFlow (Paso 2): selector de "Sensibilidad de Riesgo":
   🔵 Baja    → thresholds * 1.5 (menos sensible, flotas con muchas paradas normales)
   🟢 Normal  → thresholds default
   🔴 Alta    → thresholds * 0.7 (más sensible, cargas de alto valor o rutas peligrosas)
   Si trip.criticality='critical': usar sensibilidad Alta automáticamente

3. NOTIFICATIONS MODULE (BullMQ Consumer de 'events.triggered'):

   ABSTRACCIÓN INotificationChannel (Regla 23 — nunca llamar implementaciones directo):
   
   interface INotificationChannel {
     send(payload: NotificationPayload): Promise<void>;
     isConfigured(tenant: Tenant): boolean;
   }
   
   Implementaciones (una por canal, inyectadas por DI):
   - EmailNotificationChannel    → Nodemailer
   - PushNotificationChannel     → FCM
   - WhatsAppNotificationChannel → API configurable (ej: Twilio, Meta Business API)
   - WebhookNotificationChannel  → HTTP POST firmado
   - TicketNotificationChannel   → INSERT en tabla tickets
   
   El NotificationsService itera los canales activos según action_type de la regla.
   Para action_type='all': envía por TODOS los canales configurados del tenant.
   Si un canal no está configurado (ej: no hay FCM token): lo saltea sin error.

   'email': EmailNotificationChannel → Nodemailer con config SMTP del tenant.
     Template HTML con colores del Design System.
     Asunto: [RUSERTECH] {severity} — {eventType} — Vehículo {plate}

     TEMPLATE ÚNICO ESTANDARIZADO:
     El bloque de ubicación siempre ocupa el mismo espacio visual.
     Su contenido interno varía según el proveedor configurado en
     tenant.settings_json.static_map_provider ('geoapify'|'staticmap'|'text').
     El operador que recibe el email siempre ve el mismo formato.

     ┌─────────────────────────────────────────┐
     │ Logo Rusertech                          │
     │ ─────────────────────────────────────── │
     │ 🔴 ALERTA CRÍTICA — Exceso de Velocidad │
     │ Vehículo: ABC 123 (Alias)  Viaje: #42   │
     │ Conductor: Juan García                  │
     │ Fecha/Hora: 20/02/2026 14:32:05 -03:00  │
     │ Velocidad: 145 km/h (límite: 90 km/h)   │
     │ ─────────────────────────────────────── │
     │ 📍 UBICACIÓN DEL EVENTO                 │
     │ Av. Mitre 4521, Rosario, Santa Fe       │
     │ -32.9442° S / -60.6505° O               │
     │                                         │
     │ [imagen del mapa 600x300px]  ← si hay   │
     │  proveedor configurado                  │
     │   o bien:                               │
     │ [bloque texto con link a Google Maps]   │
     │  cuando proveedor = 'text'              │
     │ ─────────────────────────────────────── │
     │ [Ver en Rusertech] [Ver en Google Maps] │
     └─────────────────────────────────────────┘

     PROVEEDORES DE MAPA ESTÁTICO (selector en Settings del tenant):
     
     'geoapify':
       URL: https://maps.geoapify.com/v1/staticmap
         ?style=dark&width=600&height=300
         &center=lonlat:{lng},{lat}&zoom=14
         &marker=lonlat:{lng},{lat};color:{severityHex};size:large
         &apiKey={GEOAPIFY_KEY}
       Plan gratuito: 3.000 requests/día
       Configurar GEOAPIFY_KEY en tenant.settings_json
     
     'staticmap' (Node, autodependiente, sin API externa):
       Librería: @stadiamaps/staticmap o similar
       Tiles: OpenFreeMap (misma fuente que el mapa principal)
       Sin dependencia externa — generado en el propio servidor
       Más lento (~1.5s) pero sin límites ni API key
     
     'text' (sin imagen):
       El bloque de ubicación muestra solo:
         - Dirección geocodificada
         - Coordenadas en formato legible
         - Link "Ver en Google Maps" (abre con lat,lng)
       Mismo espacio, mismo layout — sin imagen

     CONFIGURACIÓN en Settings del tenant:
     Tab "Notificaciones" → sección "Mapa en emails"
     Selector: Geoapify / Generado localmente / Solo texto
     Si Geoapify: input para API key
     Cambio aplica inmediatamente, sin deploy

     Cachear URL de imagen en Redis 5 minutos para eventos del mismo punto.
     cockatiel retry: 3 intentos, backoff 1s/2s/4s
   
   'push': PushNotificationChannel → FCM con token del tenant (settings_json.fcm_token)
     Payload: { title: "[severity] eventType", body: "Vehículo {plate}", data: { vehicleId, tripId } }
   
   'whatsapp': WhatsAppNotificationChannel
     Configuración en tenant.settings_json.whatsapp_config:
       { provider: 'twilio'|'meta', accountSid, authToken, fromNumber, toNumber }
     
     Mensaje de texto estructurado (sin HTML):
     🔴 *ALERTA CRÍTICA — Exceso de Velocidad*
     Vehículo: ABC 123 (Unidad 05)
     Conductor: Juan García
     Velocidad: 145 km/h (límite: 90 km/h)
     📍 Av. Mitre 4521, Rosario, Santa Fe
     🕐 20/02/2026 14:32 hs
     👉 Ver en Rusertech: https://app.rusertech.com/trips/[id]
     
     Para RiskLevel CRITICAL → mensaje adicional urgente:
     🚨 *VIAJE EN RIESGO CRÍTICO* — Score: 87pts
     Viaje #42 | ABC 123 → Rosario
     Factores activos: Sin señal (30pts) + Desvío mayor (25pts) + Zona de peligro (35pts)
     
     cockatiel retry: 3 intentos, backoff 2s/4s/8s
     Circuit Breaker: abre si 5 fallos en 60s, espera 120s
   
   'webhook': WebhookNotificationChannel → POST a action_config.webhook_url
     Headers: X-Rusertech-Signature: HMAC-SHA256(payload, action_config.secret)
     Timeout: 10 segundos
     cockatiel Circuit Breaker: abre si 5 fallos en 30s, espera 60s
   
   'none': Solo visible en event_logs. Sin notificación externa.
   
   'ticket': TicketNotificationChannel → INSERT en tabla tickets
     (id, tenant_id, event_log_id, status='open', assignee_id)

   'push': FCM con token del tenant (settings_json.fcm_token)
     Payload: { title: "[severity] eventType", body: "Vehículo {plate}", data: { vehicleId, tripId } }
   
   'webhook': POST a action_config.webhook_url
     Headers: X-Rusertech-Signature: HMAC-SHA256(payload, action_config.secret)
     Timeout: 10 segundos
     cockatiel Circuit Breaker: abre si 5 fallos en 30s, espera 60s
   
   'none': Solo visible en event_logs. Sin notificación externa.
   
   'ticket': INSERT en tabla tickets (crear: id, tenant_id, event_log_id, status, assignee_id)

4a. CRUD DE EXCLUSIONES DE ALARMAS (AlarmTypeExclusion):

   Endpoints:
   GET    /api/v1/alarm-exclusions
   POST   /api/v1/alarm-exclusions
   PUT    /api/v1/alarm-exclusions/{id}
   DELETE /api/v1/alarm-exclusions/{id}
   PATCH  /api/v1/alarm-exclusions/{id}/toggle  ← SWITCH

   FRONTEND — /alarm-exclusions:
   
   REGLA DE ORDENAMIENTO (Regla 28 — SIEMPRE):
   1. critical → 2. warning → 3. info
   Dentro de cada nivel: timestamp DESC (más reciente primero)
   Este ordenamiento aplica en el panel, en las notificaciones y en los exports.
   Nunca mostrar una warning antes que una critical activa no reconocida.

   FILA DE ALERTA — contenido obligatorio:
   - Icono de severidad + tipo de evento
   - Placa del vehículo + badge con Trip ID si hay viaje activo (#42)
     Si no hay viaje: mostrar "Sin viaje" en gris
   - Mensaje descriptivo del evento
   - Dirección geocodificada (Nominatim/Photon (OSM — sin API key))
   - Timestamp
   - Si grouped_count > 1: badge "x{N}" en ámbar
   - Si no_signal_zone_id: badge "ZONA MUERTA"

   Plataforma de alertas:
   GET /api/v1/alerts?severity=critical,warning&status=open&order=severity_desc,time_desc
   - Lista de exclusiones con SWITCH prominente por fila
   - Columnas: Nombre | Tipo alerta | Alcance | Horario | Acción | Activo
   - Descripción inline en gris que explica en palabras qué hace cada exclusión
     Ej: "No notificar PARADA NO AUTORIZADA en Vehículo ABC123 entre 22:00 y 06:00"
   
   CreateAlarmExclusionForm (wizard simple, 4 pasos):
   
   Paso 1 — ¿QUÉ alertas excluir?
     Toggle "Todas las alertas" o selector de tipo específico
     Toggle "Solo esta severidad" o selector (info/warning/critical)
   
   Paso 2 — ¿DÓNDE aplica?
     Botones: Todo el tenant / Vehículo específico / Operación / Trip activo / Dentro de zona
     Si "Dentro de zona": selector de geocerca
   
   Paso 3 — ¿CUÁNDO aplica? (opcional)
     Rango horario con time picker (from/to)
     Días de semana con toggles: L M X J V S D
     Dejar vacío = siempre
   
   Paso 4 — ¿QUÉ hacer con la alerta?
     🔕 Suprimir notificación (guardar pero no molestar al operador)
     ⬇️ Bajar severidad (reducir urgencia)
     📋 Enviar a cola de crónicas (revisar después en lote)
   
   Preview automático antes de guardar:
     "Esta regla suprimirá las notificaciones de PARADA NO AUTORIZADA
      para el Vehículo ABC 123 entre 22:00 y 06:00 de lunes a viernes."

   /event-rules — EventRulesPage:
   - Tabla agrupada por event_type
   - Cada fila tiene SWITCH prominente (on/off visual)
   - Al apagar un switch: la regla deja de evaluarse inmediatamente
   - Sin recarga de página, sin confirmación extra. Simple.
   - Filtros: scope, severity, activo/inactivo
   
   CreateEventRuleFlow (wizard visual):
   Paso 1: Tipo de Evento (grid visual con iconos grandes):
     🚀 Velocidad  🛑 Inactividad  📍 Geocerca  🗺️ Desvío de Ruta
     🌡️ Temperatura  💧 Humedad    🔋 Batería   📡 Sin Señal
     🔑 Ignición    ⚠️ Código GPS  ⏰ Retraso   🚫 Parada no autorizada
   
   Paso 2: Alcance:
     Todo el tenant / Por vehículo (selector) / Por operación / Por viaje
   
   Paso 3: Configurar umbral:
     Inputs dinámicos según el tipo elegido
     Ej: Velocidad → "Alertar si supera X km/h por Y segundos"
     Ej: Temperatura → "Alertar si sale del rango [min]°C – [max]°C durante Y segundos"
   
   Paso 4: Severidad (botones visuales): 
     🔵 Informativo  🟡 Advertencia  🔴 Crítico
   
   Paso 5: Acción:
     ● Sin acción (solo visible en mapa)
     ● Email → input de destinatario
     ● Push notification
     ● Webhook → URL + secret
     ● Todo lo anterior
   
   Botón final: "Crear regla" (gradiente acento). Queda activa por defecto.

5. PANEL DE ALERTAS (/alerts):
   
   AlertsPage:
   - Contadores arriba: CRÍTICAS | ADVERTENCIAS | ABIERTAS | RESUELTAS HOY
   - Tabla con filtros: severity, status, event_type, vehículo, fecha
   - Row colors: borde rojo=critical, amarillo=warning, azul=info
   - Click en alerta → modal con: detalle, posición en mapa, historial del vehículo
   - Acciones rápidas (sin recarga):
     ✓ Reconocer    ✓ Resolver    ✗ Falso Positivo
   - Sonido de alerta configurable para críticas (con permiso del browser)
   - Badge en sidebar actualizado via Socket.io

6. CHECKLIST:
   □ Crear regla velocidad > 90 km/h → simular GPS con speed=100 → alerta en event_logs
   □ SWITCH de alerta: apagar → GPS con speed=200 → NO genera alerta
   □ Temperatura fuera de rango 2 minutos → alerta crítica + email enviado
   □ Código "01" del prestador + regla provider_code_event activa → alerta generada
   □ Webhook: POST recibido con firma HMAC correcta
   □ Signal loss 5 minutos → alerta signal_loss generada por CRON
   □ External Client configura su propia regla → solo aplica a sus trips
   □ Panel de alertas recibe nueva alerta sin recargar (Socket.io)
```

---

### 🔨 BLOQUE 6 — LAYOUT PRINCIPAL, MAPA Y VISTAS DE NAVEGACIÓN
**Objetivo:** Layout completo funcional. MapLibre GL JS v4. Paneles drag-resize. Todas las vistas. FilterDrawer. DrawingPanel.
**Tiempo estimado:** 5-6 días
**⚠️ Referencia visual obligatoria:** Leer `rusertech_prototype_v4_1.jsx` ANTES de escribir cualquier componente.

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 6
═══════════════════════════════════════════════════════

Bloques 0-5 completos. Construir el layout principal y todas las vistas.

LECTURA OBLIGATORIA ANTES DE CUALQUIER CÓDIGO:
1. Reglas 33 (CSS mapa), 34 (layout persistence), 35 (FilterDrawer único),
   36 (Carga de Viaje), 37 (paleta de riesgo), 38 (tooltips), 39 (bloqueo),
   40 (geocercas 1:N), 41 (fechas opcionales), 43 (Trip ID), 44 (filtros recorrido),
   5 (tokens), 10 (logo), 28 (alertas), 31 (MapLibre).
2. rusertech_prototype_v4_1.jsx — referencia visual APROBADA (v3.8).
   NO copiar el SVG del mapa — implementar MapLibre GL JS v4 real.
   SÍ respetar tokens, estructura de componentes, comportamientos y flujos.

═══════════════════════════════════════
1. LAYOUT SHELL — AppLayout.tsx
═══════════════════════════════════════

Zustand useLayoutStore:
  { panelWidth, bottomHeight, bottomCollapsed, activeNav, selectedVehicleId }
Persistencia (Regla 34):
  localStorage 'rusertech:layout:{userId}'
  Defaults: { panelWidth:340, bottomHeight:185, bottomCollapsed:false }
  Al init: leer key → restaurar. Fallback a defaults si no existe.

Estructura:
  <Topbar />           ← 52px fijo, z-index 200
  <div.workspace>
    <FleetPanel />     ← ancho=panelWidth, min 240, max 520
    <ResizableSplitter onResize={w => store.setPanelWidth(w)} />
    <div.content-area>
      <ViewRouter />
      <BottomPanel />
    </div>
  </div>

CSS CRÍTICO (Regla 33):
  .workspace    { display: flex; flex: 1; overflow: hidden; min-height: 0; }
  .content-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  ← min-height: 0 es OBLIGATORIO — sin él el mapa colapsa a 0px y queda negro.

═══════════════════════════════════════
2. TOPBAR — Topbar.tsx
═══════════════════════════════════════

height: 52px. position: fixed. z-index: 200.
background: rgba(31,42,90,0.96) + backdrop-filter: blur(16px).
borderBottom: 1px solid rgba(124,255,60,0.13).

Contenido (izquierda a derecha):
  <Logo />                 ← "R" gradiente + texto RUSERTECH (Exo 2 bold)
  <NavTabs />              ← Mapa / Viajes / Alertas / Flota / Geocercas / Analytics
  <div flex:1 />
  <GlobalSearch />         ← Ctrl+K → CommandPalette
  <TenantBadge />          ← nombre del tenant activo
  <ConnectionIndicator />  ← 🟢 "En vivo" / 🟡 "Reconectando..." / 🔴 "Sin conexión"
  <UserAvatar />           ← iniciales + dropdown logout

NavTabs:
  Click → store.setActiveNav(tab) → ViewRouter renderiza vista
  Activo: color accentGreen + background rgba(124,255,60,0.10)
  Badge numérico rojo en "Alertas" = count(open+critical) via Socket.io

═══════════════════════════════════════
3. FLEET PANEL — FleetPanel.tsx
═══════════════════════════════════════

Ancho: panelWidth. Background: bgSurface (#252D6B).
borderRight: 1px solid rgba(124,255,60,0.13).
VISIBLE EN TODAS LAS VISTAS. Solo en Analytics puede ocultarse.

a) Header fijo:
   Contador "N vehículos" + badges críticos/warning
   Input búsqueda placa/alias (debounce 300ms)
   Pills: [Todos][Con Alertas][En Viaje][Sin Señal][Bloqueados]
   Contador "Mostrando X de Y"

b) Vehicle List (react-virtual para flotas grandes):
   Orden: critical → warning → online → offline → blocked
   Tiempo real via Socket.io (vehicle:position, risk:level_changed)
   Click → store.setSelectedVehicle → flyTo + popup en mapa

c) Bottom tabs (34px fijos):
   [Resumen][Itinerarios][Estado del activo]
   "Estado del activo": detalle del vehículo seleccionado
   Sin selección: "Seleccioná una unidad en el mapa"

═══════════════════════════════════════
4. SPLITTER — ResizableSplitter.tsx
═══════════════════════════════════════

5px ancho. cursor: col-resize.
Handle: pill ⋮ centrado, siempre visible.
Background reposo: rgba(124,255,60,0.08)
Background hover/drag: rgba(124,255,60,0.30)
onMouseDown → captura mousemove global
  → onResize(clamp(e.clientX, 240, 520))
  → mouseup: done + persistir en localStorage
Componente genérico reutilizable.

═══════════════════════════════════════
5. BOTTOM PANEL — BottomPanel.tsx
═══════════════════════════════════════

Altura: bottomHeight. Drag handle 8px en borde superior.
onMouseDown → height = window.innerHeight - e.clientY - 52
clamp(h, 80, 380) → store.setBottomHeight(h) en tiempo real.

Header SIEMPRE visible (34px):
  "Eventos" + badge "N NUEVAS" rojo pulsante
  🔴 Críticas:N | 🟡 Warning:N | ✅ Resueltas hoy:N
  Botón toggle ▾/▴ → store.setBottomCollapsed(!collapsed)

Body (cuando !bottomCollapsed):
  Alertas: critical → warning → info (Regla 28)
  Cards horizontal scroll. Cada card:
    placa + #TripID (Regla 29), tipo, dirección, tiempo, acciones rápidas
  Click → AlertDetailModal

═══════════════════════════════════════
6. VIEW ROUTER — 6 vistas
═══════════════════════════════════════

switch(activeNav):
  'Mapa'      → <MapPage />
  'Viajes'    → <TripListPage />
  'Alertas'   → <AlertsPage />
  'Flota'     → <VehicleListPage />
  'Geocercas' → <GeofenceView />
  'Analytics' → <AnalyticsDashboard />

── MapPage ──
  Contenedor: position:relative; flex:1; overflow:hidden; min-height:0 (Regla 33)
  MapLibre GL JS v4:
    canvas: position:absolute; inset:0; width:100%; height:100%
    style: 'https://tiles.openfreemap.org/styles/bright'
    map.on('load', () => { map.resize(); loadAllLayers(map); }) ← CRÍTICO
  Superposición (position:absolute sobre el mapa):
    <MapKPIs />    top:12 left:12 — Críticos·En Viaje·Alertas·Sin Señal·Bloqueados
    <MapToolbar /> top:12 right:12
    <FilterDrawer /> right:0 full-height
    <DrawingPanel /> right:0 full-height (solo cuando dibujo activo)
    <PlaybackBar />  bottom del mapa (solo cuando playback activo)

── TripListPage ──
  Tabla: #ID · Estado · Vehículo · Conductor · Origen→Destino · Inicio · Riesgo · Acciones
  Row colors: verde=in_progress, ámbar=deviated/at_risk, gris=draft, tachado=cancelled
  Header: Título + contador + "⚙️ Filtros" (→FilterDrawer) + Exportar CSV/XLSX
  FAB "Declarar Viaje" → CreateTripModal (wizard 4 pasos — ver Bloque 4)

── AlertsPage ──
  KPI Cards: CRÍTICAS · ADVERTENCIAS · ABIERTAS · RESUELTAS HOY
  Tabla: critical → warning → info (Regla 28)
  Fila: severidad · tipo · placa+#TripID · dirección · tiempo · estado · acciones
  Acciones inline sin recarga. Badge NavTab via Socket.io.

── VehicleListPage ──
  Tabla: Placa · Tipo · AVL User · Estado · Señal · Bloqueo · Acciones
  SWITCH bloqueo en cada fila con confirmación modal.

── GeofenceView ──
  Split: lista izquierda 260px + mapa MapLibre derecho.
  DrawingToolbar VISIBLE PERMANENTEMENTE (no hay que activarla).
  Click lista → flyTo + highlight en mapa.

── AnalyticsDashboard ──
  KPI Cards animadas (count-up). ECharts con paleta Design System.
  NUNCA usar colores por defecto de ECharts.
  Filtros: date picker + vehículo + operación. Export CSV/XLSX.

═══════════════════════════════════════
7. MAPTOOLBAR — MapToolbar.tsx (funcional)
═══════════════════════════════════════

Posición: absolute top:12 right:12. z-index:10.
Cada botón tiene estado ON/OFF visual. No bloquea el mapa.

🔍 Buscar placa:
  → SearchBar flotante debajo, debounce 300ms
  → flyTo al vehículo + abre popup. ESC cierra.

🎯 Centrar flota:
  → map.fitBounds(bbox todos marcadores activos, {padding:60})
  → One-shot, sin estado toggle.

📍 Geocercas on/off:
  → map.setLayoutProperty('geofences-fill', 'visibility', 'visible'|'none')
  → Ídem geofences-stroke y geofences-labels.

📡 Zonas sin señal on/off:
  → Toggle capa no_signal_zones (rayas diagonales grises).

🗺️ Estilo de mapa:
  → Cicla: bright → positron → dark (OpenFreeMap).
  → map.setStyle(newStyle) + reinyectar capas propias en onStyleLoad.

🌡️ Heatmap:
  → Toggle MapLibre Heatmap Layer (GPS últimas 24h del tenant).

🕐 Playback histórico:
  → Activa PlaybackBar: selector vehículo + date range + Play/Pause + 1x/2x/5x.
  → FleetPanel colapsa automáticamente al activar.

✏️ Herramientas de dibujo:
  → DrawingToolbar reemplaza MapToolbar.
  → DrawingPanel slide-in desde la derecha.

⚙️ Filtros:
  → Abre FilterDrawer (Regla 35).
  → Badge numérico si hay filtros activos.

═══════════════════════════════════════
8. DRAWING PANEL — DrawingPanel.tsx
═══════════════════════════════════════

Activado desde ✏️. Permanente en vista Geocercas.

DrawingToolbar (reemplaza MapToolbar durante dibujo):
  🔷 Polígono · ⭕ Círculo · 〰️ Corredor · 🚧 Zona Peligrosa (rojo)
  ⚠️ Zona de Alerta (ámbar) · 🛣️ Ruta de Viaje · ❌ Cancelar

DrawingPanel (slide-in 300px, aparece al COMPLETAR el dibujo):
  Preview thumbnail SVG del dibujo
  Nombre* (obligatorio) · Descripción (opcional)
  Tipo (pre-seteado, editable) · Color picker
  País (country_code — Regla 32)
  "¿Qué acción dispara?" → event_rule selector O "Crear nueva"
  "Guardar" (gradiente acento) → POST endpoint según tipo
  "Descartar" → limpia dibujo + cierra

POST exitoso → toast + zona en mapa (optimistic UI) + panel cierra.

═══════════════════════════════════════
9. FILTER DRAWER — FilterDrawer.tsx (Regla 35)
═══════════════════════════════════════

Width: 340px. Slide-in derecha. z-index: 301. Backdrop rgba(0,0,0,0.25).
Mismo componente en todas las vistas.

HEADER: "Filtros Avanzados" · badge "N activos" · "Limpiar todo" · ×

6 GRUPOS COLAPSABLES con badge de filtros activos por grupo:

  1. 🔖 Identidad y Referencia
     ID de Viaje (text) · N° Manifiesto/Guía (text)

  2. 👤 Actores Operativos
     Patente/Placa (text) · Conductor: nombre o doc (text)
     Transportista (select) · Cliente/Tenant (select — solo rusertech_admin)

  3. 📡 Estado y Seguimiento
     Estado Operativo (multi-select pills): Iniciado · En Tránsito · Finalizado · Cancelado
     Estado Monitoreo (multi-select pills): Normal · Desvío · Zona Peligrosa · En Riesgo
     Comunicación AVL (select): Todos · >15min · >30min · >1h

  4. 📅 Temporal (colapsado por defecto)
     Rango Inicio Programado · Rango Finalización · Ventana de Creación

  5. 🗺️ Geográfico y de Ruta (colapsado por defecto)
     Ruta Asignada · Punto de Origen · Punto de Destino · Presencia en Geocerca

  6. ⚠️ Riesgo e Inteligencia
     Nivel de Riesgo (pills): Normal · Elevado · Alto · Crítico
     Tipo de Alarma (pills): Pánico · Parada No Autorizanda · Velocidad · Desvío · Sin Señal
     Toggle: Solo crónicas (>2h sin tratar)
     Toggle: Con exclusiones activas

FOOTER: "Aplicar Filtros" gradiente acento, ancho completo
  → cierra + dispara query con TripQueryFilterDto (Regla 35)

═══════════════════════════════════════
10. MARCADORES Y CAPAS MAPLIBRE
═══════════════════════════════════════

MARCADORES:
  Ícono por vehicle_type. Rotación por heading_degrees.
  Estado (borde/pulso):
    🔴 Pulsante agresivo → CRITICAL
    🟠 Pulsante → HIGH
    🟡 Pulsante leve → ELEVATED/warning
    🟢 Estático → NORMAL
    ⬜ Gris → sin señal >15min
    🟣 Violeta → bloqueado
  Badge temperatura si tiene sensor activo.
  Popup hover 500ms: placa, velocidad, temp, trip, última señal.
  Click → store.setSelectedVehicle + flyTo.

CLUSTERING:
  Círculo con número. Rojo=alguno critical, ámbar=warning, verde=todos OK.
  Click → zoom + expandir.

CAPAS DE VIAJE ACTIVO:
  #7CFF3C → ruta planificada · #E5E7EB → recorrido real · #EF4444 → desvío
  Douglas-Peucker simplification para telemetría densa.

TIEMPO REAL (Socket.io):
  'vehicle:position' → mover marcador con animación suave (lerp).
  'alert:new' → pulsar marcador + toast + badge NavTab Alertas.
  'risk:level_changed' → actualizar color marcador + fila FleetPanel.
  Reconexión: backoff exponencial → re-request positions al reconectar.

═══════════════════════════════════════
11. CHECKLIST BLOQUE 6
═══════════════════════════════════════

  □ Layout: paneles drag-resize funcionan correctamente
  □ panelWidth persiste al recargar (localStorage — Regla 34)
  □ bottomHeight persiste al recargar
  □ MapLibre carga sin pantalla negra — Regla 33 aplicada
  □ map.resize() en onLoad → mapa visible al primer render
  □ Marcadores con ícono por tipo y rotación por heading
  □ GPS simulado → marcador se mueve < 1s (Socket.io)
  □ Toolbar 🎯 → fitBounds a toda la flota
  □ Toolbar 📍 → toggle geocercas en mapa
  □ Toolbar 🗺️ → cicla entre 3 estilos de mapa
  □ Toolbar ✏️ → DrawingToolbar + DrawingPanel slide-in
  □ Dibujar polígono → completar → DrawingPanel con preview
  □ Guardar geocerca → POST → zona en mapa → toast OK
  □ FilterDrawer abre desde ⚙️ mapa Y desde "Filtros" en Viajes
  □ Aplicar filtro placa → VehicleList filtra correctamente
  □ Aplicar filtro riesgo=Crítico → solo trips críticos visibles
  □ Limpiar filtros → muestra todo
  □ NavTab Geocercas: DrawingTools visibles permanentemente
  □ NavTab Viajes: CreateTripModal 4 pasos funcional
  □ NavTab Alertas: critical→warning→info, acciones sin recarga
  □ NavTab Flota: SWITCH bloqueo funcional con efecto inmediato
  □ NavTab Analytics: ECharts con paleta Design System
  □ BottomPanel drag handle resize entre 80px y 380px
  □ PlaybackBar: aparece al activar 🕐, FleetPanel colapsa
```

---

### 🔨 BLOQUE 7 — TEMPERATURA, HUMEDAD Y SENSORES
**Objetivo:** Dashboard de sensores. Historial gráfico. Alertas con switch.
**Tiempo estimado:** 2-3 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 7
═══════════════════════════════════════════════════════

Continuamos. Bloques 0-6 completos.
Construir el módulo de monitoreo de sensores (temperatura y humedad).

RECORDATORIO CRÍTICO:
Los datos de temperatura y humedad VIENEN DEL HUB.
No los calculamos. Los recibimos en los campos Temperature y Humidity del payload.
Los parseamos a number en la ingesta y los guardamos en telemetry.temperature_c y humidity_pct.
Este módulo MUESTRA, CONFIGURA RANGOS y ALERTA. No calcula nada.

1. SENSOR CONFIG API:
   GET  /api/v1/sensors/config
   POST /api/v1/sensors/config
   PUT  /api/v1/sensors/config/{id}
   PATCH /api/v1/sensors/config/{id}/toggle  ← SWITCH on/off

2. SENSOR DATA QUERIES:
   GET /api/v1/sensors/dashboard
   → Para cada vehículo con sensor activo:
     Última temperatura + humedad de Redis (vehicle:position)
     Estado vs rango configurado
     Tiempo fuera de rango si aplica

   GET /api/v1/sensors/history/{vehicleId}
   Query params: sensorType (temperature|humidity), period (1h|6h|24h|7d)
   → Query dual según USE_TIMESCALEDB:

   -- USE_TIMESCALEDB=true (TimescaleDB):
   SELECT time_bucket('5 minutes', timestamp), AVG(temperature_c), AVG(humidity_pct)
   FROM telemetry WHERE vehicle_id=... AND timestamp > NOW()-{period}
   GROUP BY 1 ORDER BY 1

   -- USE_TIMESCALEDB=false (PostgreSQL nativo, equivalente):
   SELECT date_trunc('minute', timestamp) -
     INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp)::int % 5) AS bucket,
     AVG(temperature_c), AVG(humidity_pct)
   FROM telemetry WHERE vehicle_id=... AND timestamp > NOW()-{period}
   GROUP BY 1 ORDER BY 1

   El TelemetryQueryService elige la query según process.env.USE_TIMESCALEDB.
   La interfaz hacia el frontend es idéntica en ambos modos.

3. FRONTEND /sensors:

   SensorDashboard:
   Grid de cards, una por vehículo con sensor activo
   
   Cada card — TEMPERATURA:
   - Número grande centrado: temperatura actual (font: JetBrains Mono)
   - Color dinámico del número según estado (del Design System):
     Azul → bajo rango mínimo
     Verde → en rango normal
     Ámbar → sobre rango máximo
     Rojo pulsante → crítico (mucho fuera de rango)
   - Gauge semicircular con zona verde visible (rango configurado)
   - Badge: "✓ En rango" verde / "⚠ Fuera de rango" ámbar / "🔴 Crítico" rojo
   - Sparkline de últimas 2 horas

   Cada card — HUMEDAD (misma lógica, misma UI, diferente sensor):
   - Si el vehículo tiene sensor de humedad: mostrar debajo de temperatura en la card
   - Mismo esquema de colores

   Click en card → modal con:
   - Gráfico completo de línea temporal (ECharts)
   - Bandas de color: zona verde del rango, rojas fuera
   - Marcadores en puntos donde se disparó una alerta
   - Selector de período: 1h / 6h / 24h / 7 días
   - Tab: Temperatura | Humedad

   SensorConfig (/sensors/config):
   - Por vehículo, operación o viaje
   - Sliders visuales para min/max con rango coloreado
   - Campo: tiempo sostenido (minutos) antes de alertar
   - Campo: delta de cambio brusco (°C o % por minuto)
   - SWITCH global on/off por configuración
   - El sensor_type se elige: Temperatura | Humedad | Ambos

4. CHECKLIST:
   □ Payload con Temperature="25.5" → guardado como temperature_c=25.5 en DB
   □ Payload con Temperature="" → guardado como NULL (no crashea)
   □ Card de sensor muestra color correcto según rango configurado
   □ Gráfico temporal muestra banda verde del rango
   □ Alerta de temperatura se dispara al superar rango por N segundos
   □ SWITCH de sensor config desactiva la alerta inmediatamente
```

---

### 🔨 BLOQUE 8 — HUELLA DE CARBONO Y ANALYTICS
**Objetivo:** Dashboard analítico. Cálculo de CO2 con Climatiq (toggleable). Reportes.
**Tiempo estimado:** 3-4 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 8
═══════════════════════════════════════════════════════

Continuamos. Bloques 0-7 completos.
Construir analytics y el módulo de huella de carbono.

CONTEXTO:
La huella de carbono es un CÁLCULO INTERNO que se ejecuta al completar un viaje.
Usa: km recorridos (calculados desde telemetría PostGIS) + velocidad promedio + modelo de vehículo.
Puede usar la API Climatiq (si está activada en carbon_settings del tenant).
Tiene un SWITCH en la UI para activar/desactivar Climatiq con un click.

1. CARBON FOOTPRINT CALCULATOR (BullMQ Consumer de 'carbon.calculate'):

   Al recibir { tripId, vehicleId, tenantId }:
   
   a) Obtener puntos GPS del viaje:
      SELECT latitude, longitude, location, timestamp
      FROM telemetry
      WHERE vehicle_id=$vehicleId 
        AND timestamp BETWEEN actual_start AND actual_end
      ORDER BY timestamp ASC
   
   b) Calcular distancia total (PostGIS):
      SELECT SUM(ST_Distance(prev.location, curr.location)) / 1000 as km
      (usar LAG window function para obtener punto previo)
   
   c) Calcular velocidad promedio del viaje
   
   d) Obtener datos del vehículo: fuel_type, fuel_efficiency_lper100km
   
   e) Obtener carbon_settings del tenant:
      Si use_climatiq_api=FALSE o climatiq_api_key vacío → usar fórmula interna
      Si use_climatiq_api=TRUE → llamar Climatiq API

   FÓRMULA INTERNA:
     fuel_liters = (distance_km / 100) * fuel_efficiency_lper100km
     co2_kg según fuel_type:
       diesel:   fuel_liters * 2.68
       gasoline: fuel_liters * 2.31
       electric: 0 (sin emisiones directas)
       hybrid:   fuel_liters * 1.90 (estimado)

   CLIMATIQ API (si activada):
     POST https://api.climatiq.io/data/v1/estimate
     Headers: Authorization: Bearer {climatiq_api_key}
     Body: {
       emission_factor: { activity_id: "fuel_combustion-{fuel_type}", data_version: "^21" },
       parameters: { volume: fuel_liters, volume_unit: "l" }
     }
     Usar cockatiel retry si falla. Si falla 3 veces: fallback a fórmula interna.
   
   f) INSERT carbon_logs con todos los datos y método usado

2. CARBON SETTINGS API:
   GET   /api/v1/carbon/settings
   PATCH /api/v1/carbon/settings/toggle-climatiq  ← SWITCH principal
   PUT   /api/v1/carbon/settings

3. ANALYTICS QUERIES (modo dual — Regla 45):
   
   GET /api/v1/analytics/fleet
   Query params: period (day|week|month|year), vehicleId?, operationId?
   → Agregaciones temporales de telemetría usando date_trunc() (nativo)
     o time_bucket() (TimescaleDB). TelemetryQueryService abstrae el modo.

   GET /api/v1/analytics/carbon
   → Suma co2_kg por período, por vehículo, por operación, comparativo anterior

   GET /api/v1/analytics/trips
   → Trips on-time vs delayed, desvíos promedio, duración real vs estimada

   GET /api/v1/analytics/alerts
   → Alertas por tipo, por severidad, por vehículo (top 5 más problemáticos)

4. FRONTEND /analytics:

   KPI Cards (con animación count-up al cargar):
   - Total km este período
   - Trips completados / cancelados
   - Velocidad promedio de flota
   - Total CO2 este período (si Climatiq está habilitado)
   
   Gráficos ECharts con paleta del Design System:
   - Line chart: km por día (fondo transparente, línea gradiente acento)
   - Bar chart: alertas por tipo (barras coloreadas por severidad)
   - Donut: distribución de estados de trips (colores del Design System)
   - Heatmap: actividad por hora del día y día de semana (para optimización)
   
   Filtros: date picker período, vehículo, operación

5. FRONTEND /carbon:
   
   SWITCH grande y prominente en el header de la página:
   "Calcular con Climatiq API" [toggle] — al activar: pide API Key si no hay una guardada
   
   CarbonDashboard:
   - Número grande: CO2 total del mes (toneladas)
   - Verde si bajó vs mes anterior, rojo si subió
   - Comparativo: { CO2 este mes } vs { CO2 mes anterior } con % de cambio
   
   Tabla por vehículo:
   - Placa, tipo de combustible, km, litros estimados, CO2 kg, método usado
   - Ordenar por CO2 (mayor contaminador primero)
   
   Gráfico tendencia: CO2 por mes últimos 12 meses
   
   Exportar:
   - CSV con datos crudos
   - XLSX con formato visual (exceljs — sin licencia EPPlus)
     Columnas con header estilizado (fondo #1F2A5A, texto blanco, Exo 2)
     Filas alternadas en gris claro / blanco para legibilidad
   - PDF con reporte de sostenibilidad (usando @react-pdf/renderer)

6. CHECKLIST:
   □ Completar viaje → job 'carbon.calculate' procesado → registro en carbon_logs
   □ Fórmula interna: distancia 100km, diesel, 30L/100km → 100/100*30*2.68=80.4 kg CO2
   □ SWITCH Climatiq: activar → próximo viaje usa Climatiq API
   □ Climatiq falla → fallback a fórmula interna sin error visible
   □ Dashboard de analytics carga con datos reales de telemetría
   □ Gráfico de tendencia CO2 muestra últimos 12 meses
```

---

### 🔨 BLOQUE 9 — ADMINISTRACIÓN MULTI-TENANT Y DEPLOYMENT HTTPS
**Objetivo:** Panel de superadmin. Onboarding de clientes. HTTPS productivo con Let's Encrypt.
**Tiempo estimado:** 3-4 días

```
═══════════════════════════════════════════════════════
PROMPT BLOQUE 9
═══════════════════════════════════════════════════════

Bloque final. Bloques 0-8 completos.
Administración multi-tenant y deployment en producción con HTTPS.

1. ADMIN MODULE (solo rusertech_admin):

   GET  /api/v1/admin/tenants
   POST /api/v1/admin/tenants
   PUT  /api/v1/admin/tenants/{id}
   PATCH /api/v1/admin/tenants/{id}/suspend
   GET  /api/v1/admin/tenants/{id}/stats
   → { vehicleCount, activeTrips, openAlerts, lastActivity }

   CreateTenantCommand:
   - name, slug (validar único), plan, adminEmail, adminFullName
   - Genera password temporal
   - INSERT tenant + 6 roles para ese tenant + usuario account_owner
   - INSERT carbon_settings con use_climatiq_api=false
   - Enviar email de bienvenida con Nodemailer (template HTML Rusertech)

2. SETTINGS MODULE (account_owner + manager):
   
   GET /api/v1/settings/profile           → datos del tenant
   PUT /api/v1/settings/profile           → actualizar nombre, timezone, logo
   
   GET /api/v1/settings/users
   POST /api/v1/settings/users/invite    → crear usuario del tenant
   PUT /api/v1/settings/users/{id}       → cambiar rol
   PATCH /api/v1/settings/users/{id}/toggle → activar/desactivar

3. FRONTEND /admin (solo rusertech_admin):
   
   Tabla de tenants con: nombre, plan, estado, vehículos, viajes activos, última actividad
   Botón "Nuevo Cliente" → form: nombre, slug, plan, email admin
   SWITCH suspend/activate por tenant
   Click en tenant → ver sus stats

4. FRONTEND /settings:
   
   Tab "Mi Empresa": nombre, timezone, logo upload
   Tab "Usuarios": tabla con roles, SWITCH activo/inactivo por usuario, botón invitar
   Tab "Prestadores / AVL": redirige a /avl (módulo completo de AVL Users)
   Tab "Parámetros del Sistema" (solo manager+):
     Tabla de parameter_settings editables por el tenant
     Agrupados por categoría:
       🚨 Motor de Alertas: signal_loss_alert_minutes, chronic_alarm_reeval_minutes
       ⚠️ Niveles de Riesgo: risk_elevated/high/critical_score_threshold, risk_decay_rate_per_hour
       🗺️ Viajes: default_corridor_meters, trip_autostart_on_origin_exit
       🌐 Geocodificación: geocoding_cache_hours, static_map_zoom_level
       🗺️ Recorridos: route_similarity_radius_meters, default_country
     Cada parámetro: label descriptivo + input (number/toggle/select según data_type)
     Botón "Restaurar valores por defecto" por categoría
     Los cambios aplican inmediatamente en el motor — sin deploy
   Tab "Notificaciones": configurar SMTP, FCM token
   Tab "Huella de Carbono": SWITCH Climatiq + API Key input

5. POSITION FORWARDING MODULE (/settings/forwarding — solo account_owner y manager):

   CONCEPTO: permite a un cliente enterprise reenviar el stream de posiciones GPS
   de su flota a sus propios sistemas (TMS, ERP, portal propio) en tiempo real.
   Es DIFERENTE a los webhooks de alertas (que son eventos puntuales).
   
   Endpoints:
   GET    /api/v1/forwarding                   → lista de forwarders del tenant
   GET    /api/v1/forwarding/{id}              → detalle
   POST   /api/v1/forwarding                   → crear forwarder
   PUT    /api/v1/forwarding/{id}              → actualizar
   DELETE /api/v1/forwarding/{id}              → eliminar
   PATCH  /api/v1/forwarding/{id}/toggle       → SWITCH activo/inactivo
   PATCH  /api/v1/forwarding/{id}/reset-circuit → resetear circuit breaker manualmente
   GET    /api/v1/forwarding/{id}/stats        → total_sent, total_failed, last_error, circuit_open

   FORWARDING WORKER (BullMQ Consumer de 'forwarding.send'):
   
   Para cada job de forwarding:
   a) Cargar configuración del forwarder desde DB (cache Redis 5min)
   b) Verificar circuit_open: si true → descartar silenciosamente, log métrica
   c) Construir payload según payload_format:
      
      'rusertech' → formato estándar:
      {
        vehicleId, plate, alias, avlUserId,
        lat, lng, speedKmh, headingDegrees, ignition,
        temperatureC, humidityPct, batteryPct, odometerKm,
        address,    ← dirección geocodificada (si está en cache Redis)
        tripId,     ← null si no hay viaje activo
        timestamp,
        eventType,  ← null si no es un evento especial
        signature:  ← HMAC-SHA256 del body con secret_key del forwarder
      }
      
      'custom' → aplicar payload_template:
      Reemplazar variables {{variable}} con valores del punto GPS.
      Variables disponibles: {{latitude}}, {{longitude}}, {{speedKmh}},
      {{plate}}, {{alias}}, {{timestamp}}, {{tripId}}, {{address}},
      {{temperatureC}}, {{humidityPct}}, {{ignition}}, {{heading}}
   
   d) Si batch_size > 1: acumular en Redis LIST por forwarder, enviar cuando alcanza el tamaño
      RPUSH forward:batch:{forwarderId} {payload} → si LLEN >= batch_size → LRANGE + DEL + enviar
   
   e) HTTP POST/PUT a target_url con custom_headers
      Timeout: 15 segundos
      cockatiel retry: 2 intentos, backoff 1s/3s
      
   f) Si éxito: UPDATE total_sent++, last_forwarded_at=NOW()
   g) Si falla después de retries:
      UPDATE total_failed++, last_error, last_error_at
      Si total_failed en últimos 60s >= 5: abrir circuit breaker
        UPDATE circuit_open=true, circuit_opened_at=NOW()
        Publicar evento para que el operador sea notificado
   
   CIRCUIT BREAKER RECOVERY (CRON cada 5 minutos):
   Para cada forwarder con circuit_open=true:
     Si NOW() - circuit_opened_at >= 5 minutos: intentar ping al target_url
     Si ping exitoso: UPDATE circuit_open=false
     Si falla: mantener abierto, loguear

   FRONTEND — ForwardingPage (/settings/forwarding):
   
   Lista de forwarders como cards (similar a AVL Users):
   Header: nombre + badge estado (activo/inactivo/circuit-open)
   Métricas en tiempo real: "12.450 enviados | 3 fallidos | Último: hace 2s"
   Badge rojo "CIRCUIT OPEN" si el circuito está abierto, con botón "Reset manual"
   SWITCH toggle activar/desactivar
   Botón "Configurar"
   
   ForwarderForm (crear/editar):
   Sección 1 — DESTINO:
     - Nombre descriptivo
     - URL destino + método HTTP
     - Secret Key (para firma HMAC)
     - Headers personalizados (key-value pairs)
   
   Sección 2 — FILTROS:
     - Toggle "Todos los vehículos" o selección múltiple
     - Toggle "Solo vehículos con viaje activo"
     - Velocidad mínima (input numérico, opcional)
   
   Sección 3 — FORMATO:
     - Selector: Formato Rusertech (estándar) / Personalizado
     - Si personalizado: editor JSON con preview en tiempo real
       y documentación de variables disponibles inline
   
   Sección 4 — BATCHING:
     - Toggle "Envío individual" (default) o "Envío en lote"
     - Si lote: slider tamaño (2-100 posiciones) + intervalo ms
   
   Sección 5 — TEST:
     - Botón "Enviar posición de prueba"
     - Envía un payload de ejemplo al target_url y muestra la respuesta HTTP
     - Verde si 2xx, rojo si error

6. NGINX + HTTPS (infra/nginx/nginx.conf):

   server {
     listen 80;
     server_name app.rusertech.com;
     return 301 https://$host$request_uri;
   }

   server {
     listen 443 ssl http2;
     server_name app.rusertech.com;

     ssl_certificate     /etc/letsencrypt/live/app.rusertech.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/app.rusertech.com/privkey.pem;
     ssl_protocols       TLSv1.2 TLSv1.3;

     # WebSocket para Socket.io
     location /socket.io/ {
       proxy_pass http://api:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header X-Real-IP $remote_addr;
       proxy_read_timeout 3600s;
     }

     # API
     location /api/ {
       proxy_pass http://api:3000;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-Proto https;
     }

     # Frontend SPA
     location / {
       proxy_pass http://web:5173;
       try_files $uri /index.html;
     }
   }

6. DOCKER COMPOSE PRODUCCIÓN (infra/docker-compose.prod.yml):
   
   services:
     api:
       build: ./apps/api
       restart: always
       env_file: ./apps/api/.env.prod
       healthcheck: { test: curl -f http://localhost:3000/health }
       depends_on: [redis]
     
     web:
       build: ./apps/web
       restart: always
       environment:
         VITE_API_URL: https://app.rusertech.com/api
         VITE_SOCKET_URL: https://app.rusertech.com
         VITE_OPENFREEMAP_NO_TOKEN_REQUIRED: ${OPENFREEMAP_NO_TOKEN_REQUIRED}
     
     redis:
       image: redis:7-alpine
       restart: always
       # En producción usar Upstash — este es fallback local
     
     nginx:
       image: nginx:alpine
       restart: always
       ports: ["80:80", "443:443"]
       volumes:
         - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf
         - /etc/letsencrypt:/etc/letsencrypt:ro
       depends_on: [api, web]

   Certbot para obtener certificado:
   certbot certonly --standalone -d app.rusertech.com \
     --email admin@rusertech.com --agree-tos --non-interactive

7. HEALTH CHECK ENDPOINT:
   GET /health → { status:'ok', timestamp, db:'connected', redis:'connected' }

8. CHECKLIST FINAL DE PRODUCCIÓN:
   □ SSL activo en https://app.rusertech.com con certificado válido
   □ HTTP redirige a HTTPS automáticamente
   □ WebSocket funciona en HTTPS (wss://)
   □ Login funciona en producción
   □ HUB puede enviar telemetría a https://app.rusertech.com/api/v1/telemetry/ingest
   □ Variables de entorno en .env.prod (NO en repositorio)
   □ Backup automático de Supabase configurado (Supabase lo hace por defecto en plan Pro)
   □ RLS verificado en Supabase: Authentication → Policies
   □ Logo Rusertech visible en todas las pantallas
   □ Renovación automática de certificado: certbot renew --quiet en cron diario
```

---

# PARTE III — REFERENCIA RÁPIDA

---

## 📋 ENDPOINTS COMPLETOS

```
AUTH
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

VEHICLES
GET    /api/v1/vehicles
GET    /api/v1/vehicles/live          ← Solo Redis, < 50ms
GET    /api/v1/vehicles/{id}
POST   /api/v1/vehicles
PUT    /api/v1/vehicles/{id}
DELETE /api/v1/vehicles/{id}
PATCH  /api/v1/vehicles/{id}/block    ← SWITCH bloqueo
POST   /api/v1/vehicles/import        ← Bulk import CSV/XLSX
GET    /api/v1/vehicles/import/template ← Descargar plantilla

NO SIGNAL ZONES
GET    /api/v1/no-signal-zones
GET    /api/v1/no-signal-zones/{id}
POST   /api/v1/no-signal-zones
PUT    /api/v1/no-signal-zones/{id}
DELETE /api/v1/no-signal-zones/{id}
PATCH  /api/v1/no-signal-zones/{id}/toggle

TRIPS (pre-trip validation)
POST   /api/v1/trips/{id}/validate-route ← Devuelve warnings geoespaciales antes de programar

DRIVERS
GET    /api/v1/drivers
GET    /api/v1/drivers/available
GET    /api/v1/drivers/{id}
POST   /api/v1/drivers
PUT    /api/v1/drivers/{id}
DELETE /api/v1/drivers/{id}

OPERATIONS
GET/POST/PUT/DELETE /api/v1/operations

AVL USERS (configuración central de User_avl)
GET    /api/v1/avl-users
GET    /api/v1/avl-users/{id}
POST   /api/v1/avl-users
PUT    /api/v1/avl-users/{id}
DELETE /api/v1/avl-users/{id}
PATCH  /api/v1/avl-users/{id}/toggle
POST   /api/v1/avl-users/{id}/regenerate-api-key
GET    /api/v1/avl-users/{id}/credentials
GET    /api/v1/avl-users/{id}/dictionary
POST   /api/v1/avl-users/{id}/dictionary
PUT    /api/v1/avl-users/{id}/dictionary/{dictId}
DELETE /api/v1/avl-users/{id}/dictionary/{dictId}
PATCH  /api/v1/avl-users/{id}/dictionary/{dictId}/toggle
GET    /api/v1/avl-users/{id}/unknown-codes

GEOFENCES
GET    /api/v1/geofences
GET    /api/v1/geofences/{id}
POST   /api/v1/geofences/polygon
POST   /api/v1/geofences/circle
POST   /api/v1/geofences/corridor
PUT    /api/v1/geofences/{id}
DELETE /api/v1/geofences/{id}
PATCH  /api/v1/geofences/{id}/toggle  ← SWITCH
POST   /api/v1/geofences/check-point
GET    /api/v1/geofences/{id}/export/geojson
GET    /api/v1/geofences/{id}/export/kml

TRIPS
GET    /api/v1/trips
GET    /api/v1/trips/{id}
GET    /api/v1/trips/command-center
POST   /api/v1/trips
POST   /api/v1/trips/{id}/schedule
POST   /api/v1/trips/{id}/start
POST   /api/v1/trips/{id}/complete
POST   /api/v1/trips/{id}/cancel
PUT    /api/v1/trips/{id}/route
POST   /api/v1/trips/{id}/acknowledge-deviation
GET    /api/v1/trips/{id}/export/geojson
GET    /api/v1/trips/{id}/export/kml

EVENT RULES
GET    /api/v1/event-rules
POST   /api/v1/event-rules
PUT    /api/v1/event-rules/{id}
DELETE /api/v1/event-rules/{id}
PATCH  /api/v1/event-rules/{id}/toggle  ← SWITCH

ALERTS
GET    /api/v1/alerts
POST   /api/v1/alerts/{id}/acknowledge
POST   /api/v1/alerts/{id}/resolve
POST   /api/v1/alerts/{id}/false-positive

SENSORS (Temperatura + Humedad)
GET    /api/v1/sensors/dashboard
GET    /api/v1/sensors/history/{vehicleId}
GET    /api/v1/sensors/config
POST   /api/v1/sensors/config
PUT    /api/v1/sensors/config/{id}
PATCH  /api/v1/sensors/config/{id}/toggle  ← SWITCH

CARBON FOOTPRINT
GET    /api/v1/carbon
GET    /api/v1/carbon/settings
PATCH  /api/v1/carbon/settings/toggle-climatiq  ← SWITCH
PUT    /api/v1/carbon/settings
GET    /api/v1/carbon/export/csv
GET    /api/v1/carbon/export/xlsx
GET    /api/v1/analytics/export/xlsx    ← reporte completo de flota en Excel

ANALYTICS
GET    /api/v1/analytics/fleet
GET    /api/v1/analytics/carbon
GET    /api/v1/analytics/trips
GET    /api/v1/analytics/alerts

TELEMETRY HUB (API Key — sin JWT)
POST   /api/v1/telemetry/ingest

AVL SIMULATOR (dev/staging — JWT requerido, AVL_SIMULATOR_ENABLED=true)
POST   /api/v1/simulator/send          ← enviar punto GPS individual
POST   /api/v1/simulator/route         ← simular recorrido completo de una ruta
POST   /api/v1/simulator/alert         ← lanzar alerta directa al motor
GET    /api/v1/simulator/status        ← jobs activos en BullMQ
DELETE /api/v1/simulator/route/{jobId} ← cancelar simulación en curso

RISK SIMULATOR (rusertech_admin ÚNICAMENTE — Regla 30)
GET    /api/v1/simulator/risk/factors   ← tabla de factores configurables
POST   /api/v1/simulator/risk/calculate ← calcular score con factores dados
-- No es una API de producción. Es UI interna del admin para testear scoring.

UBICACIONES Y RECORRIDOS
GET    /api/v1/locations
POST   /api/v1/locations
PUT    /api/v1/locations/{id}
DELETE /api/v1/locations/{id}
PATCH  /api/v1/locations/{id}/toggle

GET    /api/v1/routes
GET    /api/v1/routes/{id}
POST   /api/v1/routes
PUT    /api/v1/routes/{id}
DELETE /api/v1/routes/{id}
PATCH  /api/v1/routes/{id}/toggle
GET    /api/v1/routes/{id}/trips
GET    /api/v1/routes/by-operation/{operationId}

POSITION FORWARDING
GET    /api/v1/forwarding
GET    /api/v1/forwarding/{id}
POST   /api/v1/forwarding
PUT    /api/v1/forwarding/{id}
DELETE /api/v1/forwarding/{id}
PATCH  /api/v1/forwarding/{id}/toggle
PATCH  /api/v1/forwarding/{id}/reset-circuit
GET    /api/v1/forwarding/{id}/stats

ADMIN (rusertech_admin only)
GET    /api/v1/admin/tenants
POST   /api/v1/admin/tenants
PUT    /api/v1/admin/tenants/{id}
PATCH  /api/v1/admin/tenants/{id}/suspend
GET    /api/v1/admin/tenants/{id}/stats

SETTINGS
GET/PUT /api/v1/settings/profile
GET     /api/v1/settings/users
POST    /api/v1/settings/users/invite
PUT     /api/v1/settings/users/{id}
PATCH   /api/v1/settings/users/{id}/toggle

TRIPS (agregados mid-trip)
POST   /api/v1/trips/{id}/change-vehicle
POST   /api/v1/trips/{id}/change-driver
POST   /api/v1/trips/{id}/add-note
GET    /api/v1/trips/{id}/history         ← TravelCommandHistory completo

CONTROL ZONES
GET    /api/v1/control-zones
GET    /api/v1/control-zones/{id}
POST   /api/v1/control-zones
PUT    /api/v1/control-zones/{id}
DELETE /api/v1/control-zones/{id}
PATCH  /api/v1/control-zones/{id}/toggle

RISK LEVEL
GET    /api/v1/trips/{id}/risk            ← Nivel actual + score + factores activos
GET    /api/v1/trips/{id}/risk/history    ← Historial de cambios de nivel
GET    /api/v1/risk/active                ← Todos los viajes activos con riesgo > normal

PARAMETER SETTINGS
GET    /api/v1/settings/parameters
PUT    /api/v1/settings/parameters/{key}
POST   /api/v1/settings/parameters/reset  ← Restaurar defaults

ALARM EXCLUSIONS (ya existía, agrega filtro por estado de viaje)
PATCH  /api/v1/alarm-exclusions/{id}/toggle

CHRONIC QUEUE
GET    /api/v1/alerts/chronic             ← Cola de alertas crónicas
POST   /api/v1/alerts/chronic/{id}/review ← Operador marca como revisada

AUDIT LOG
GET    /api/v1/audit?entity={type}&id={uuid}   ← Historial de un objeto
GET    /api/v1/audit?user={userId}             ← Acciones de un usuario
GET    /api/v1/audit/trips/{id}               ← TravelCommandHistory + audit_log
```

## 🔑 REDIS SCHEMA

```
avl:apikey:{apiKey}               → { avlUserId, tenantId, userAvlCode }     TTL: 1h
vehicle:asset:{avlUserId}:{asset} → vehicleId                                TTL: 1h
vehicle:position:{vehicleId}      → { lat, lng, speed, temp, hum, avlUser,
                                       ignition, address, timestamp }          TTL: 1h
vehicle:ids:{tenantId}            → SET de vehicleIds del tenant              TTL: sin límite
trip:active:{vehicleId}           → tripId (o null)                          TTL: 48h
trip:risk:{tripId}                → { level, score, factors, updatedAt }     TTL: duración viaje
controlzone:status:{tripId}:{geoId} → 'inside'|'outside'                    TTL: 48h
avl:code:{avlUserId}:{code}       → { eventType, triggersAlert, severity }   TTL: 6h
avl:unknown:{avlUserId}           → SET de raw_codes sin mapear              TTL: sin límite
geocode:{lat4d}:{lng4d}           → "Av. Corrientes 1234, Buenos Aires"      TTL: 24h
dedup:{vehicleId}:{timestamp}     → "1"                                      TTL: 5min
geofence:status:{vehicleId}:{geoId} → "inside"|"outside"                    TTL: 1h
vehicle:last_ts:{vehicleId}       → timestamp del último punto (anti time-travel) TTL: 48h
speed:timer:{vehicleId}           → contador segundos excediendo             TTL: dinámico
idle:timer:{vehicleId}            → contador segundos idle                   TTL: dinámico
temp:timer:{vehicleId}            → contador segundos fuera de rango         TTL: dinámico
temp:prev:{vehicleId}             → temperatura anterior (spike check)       TTL: 2min
ignition:prev:{vehicleId}         → boolean anterior                         TTL: 1h
params:{tenantId}                 → JSON de parameter_settings del tenant    TTL: 5min
forwarders:tenant:{tenantId}     → array de forwarders activos del tenant    TTL: 5min
forward:batch:{forwarderId}      → LIST de payloads pendientes de envío      TTL: 10min
auth:refresh:{userId}             → refreshToken                             TTL: 7d
```

## ⚡ SWITCHES DEL SISTEMA

| Switch | Ubicación en UI | Efecto inmediato |
|--------|----------------|------------------|
| Activar/desactivar AVL User | Sección AVL / card del avl_user | Ingesta del HUB rechazada con 403 |
| Activar/desactivar código de diccionario | Diccionario del AVL User | El código deja de interpretarse |
| Bloquear vehículo | Tabla de vehículos o mapa | Próxima ingesta descartada silenciosamente |
| Activar/desactivar regla de alerta | Tabla de reglas | La regla deja de evaluarse |
| Activar/desactivar exclusión de alarma | Tabla de exclusiones | La exclusión deja de aplicarse |
| Activar/desactivar sensor config | Config de sensores | Deja de alertar por temperatura/humedad |
| Activar Climatiq API | Panel de carbono | Próximo viaje completado usa Climatiq |
| Activar/desactivar geocerca | Tabla de geocercas | Deja de evaluar enter/exit de esa zona |
| Suspender tenant | Panel admin | Tenant no puede loguearse ni ingestar datos |
| Activar/desactivar forwarder | Configuración de forwarding | Deja de reenviar posiciones a ese destino |
| Reset circuit breaker de forwarder | Card del forwarder | Reanuda envíos al destino externo |

---

*Documento: RUSERTECH_MASTER_PROMPT_v4.0*  
*Stack: TypeScript · NestJS · React · Supabase · Upstash*  
*Referencia visual: rusertech_prototype_v4_1.jsx*  
*Este archivo es el contexto maestro permanente del proyecto.*  
*Cargarlo en cada sesión de IDE antes de comenzar cualquier bloque.*  
*Versión v3.9 queda archivada — no usar en paralelo con este archivo.*
