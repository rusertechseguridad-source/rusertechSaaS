/**
 * EXENCIONES DE LOS BARRIDOS — cada una con su motivo escrito.
 *
 * Una exención sin motivo es un agujero con permiso. Por eso el tipo obliga a
 * escribir `motivo`: no se puede agregar una sin decir por qué, y quien la lea
 * dentro de seis meses sabe si sigue valiendo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DOS CLASES, Y LA DIFERENCIA IMPORTA
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   · `permanente` → la regla NO aplica acá, y no va a aplicar. `POST /login`
 *     no puede exigir permisos: es la puerta de entrada. No hay nada que
 *     arreglar.
 *
 *   · `temporal` → la regla SÍ debería aplicar, pero hoy no se cumple. Es
 *     deuda declarada, con el hallazgo anotado. El barrido queda en verde a
 *     propósito: uno en rojo permanente se ignora desde el primer día, y
 *     entonces no protege nada.
 *
 * Las temporales se listan en el reporte de cada tanda para que no se
 * conviertan en permanentes por olvido.
 *
 * ⚠️ TODA exención tiene que corresponder a algo REAL. Si un archivo se
 * renombra o una ruta se borra, la exención queda apuntando al vacío y la
 * regla que exime deja de correr sobre el archivo nuevo — en silencio. Por eso
 * cada barrido comprueba que sus exenciones sigan existiendo y falla si no.
 * Es la parte que se limpia sola.
 */

export interface Exencion {
  /** Ruta relativa a `apps/api/src`, con `/` como separador. */
  archivo: string;
  /** Por qué esta regla no aplica acá. Obligatorio. */
  motivo: string;
  /**
   * `permanente`: la regla no aplica y no va a aplicar.
   * `temporal`: deuda declarada; el hallazgo está anotado en el reporte.
   */
  clase: 'permanente' | 'temporal';
  /** Sólo para las temporales: dónde está anotado el hallazgo. */
  anotadoEn?: string;
}

// ══════════════════════════════════════════════════════════════════════════
// R1 · Controladores con rutas de escritura sin autorización
// ══════════════════════════════════════════════════════════════════════════

export const SIN_AUTORIZACION: Exencion[] = [
  {
    archivo: 'auth/auth.controller.ts',
    clase: 'permanente',
    motivo:
      'POST /auth/login es la puerta de entrada: exigir un permiso para entrar ' +
      'sería un círculo. Lleva LocalAuthGuard (usuario y contraseña) y, desde la ' +
      'Tanda 7, límite de peticiones antes del guard caro.',
  },
  {
    archivo: 'telemetry/telemetry.controller.ts',
    clase: 'permanente',
    motivo:
      'El ingest del HUB no se autentica con JWT sino con ApiKeyGuard, que ' +
      'resuelve el AVL user y su tenant desde la clave. No hay un usuario con ' +
      'permisos del otro lado: hay una integración.',
  },
  {
    archivo: 'health/health.controller.ts',
    clase: 'permanente',
    motivo:
      'Quien consulta la salud es el balanceador, una máquina sin credenciales. ' +
      'Por eso la respuesta tampoco incluye versiones ni cadenas de conexión. ' +
      'No tiene rutas de escritura; está acá para que la regla de "sin guard" ' +
      'no lo marque.',
  },
  {
    archivo: 'app.controller.ts',
    clase: 'temporal',
    motivo:
      'POST /upload exige sesión (JwtAuthGuard) pero ningún permiso: el catálogo ' +
      'no tiene uno para subir archivos y la regla del proyecto es no inventar ' +
      'permisos nuevos. Queda como deuda: o se agrega `manage_uploads` al ' +
      'catálogo, o se decide que la sesión alcanza.',
    anotadoEn: 'REPORTE_TANDA_8.md § Lo que el barrido encontró',
  },
  {
    archivo: 'simulator/simulator.controller.ts',
    clase: 'temporal',
    motivo:
      'Está detrás de AVL_SIMULATOR_ENABLED, así que en producción no existe. El ' +
      'catálogo SÍ tiene `use_simulator` y el decorador no está puesto: es ' +
      'cableado pendiente, no una excepción de diseño.',
    anotadoEn: 'REPORTE_TANDA_8.md § Lo que el barrido encontró',
  },
  {
    archivo: 'admin/admin.controller.ts',
    clase: 'permanente',
    motivo:
      'Las rutas pasan por checkSuperAdmin(), que compara contra ADMIN_ROLES y ' +
      'es MÁS estricto que cualquier permiso del catálogo: un permiso se puede ' +
      'conceder a un rol de cliente, el rol de plataforma no.',
  },
  {
    archivo: 'settings/settings.controller.ts',
    clase: 'temporal',
    motivo:
      '⚠️ HALLAZGO DEL BARRIDO. Tres rutas —PUT /profile, POST /users/invite y ' +
      'PUT /users/:id— comprueban el rol con un `if (req.user.role !== …) throw ' +
      'ForbiddenException` escrito a mano DENTRO del handler, en vez de con ' +
      '@Roles. La autorización existe y funciona, pero queda fuera del sistema de ' +
      'guards: no la ve este barrido, no la ve Nest, y la lista de roles está ' +
      'duplicada en cada handler. Se anota, no se corrige: esta tanda es cableado.',
    anotadoEn: 'REPORTE_TANDA_8.md § Lo que el barrido encontró',
  },
];

// ══════════════════════════════════════════════════════════════════════════
// R5 · Consultas Prisma sin filtro por tenant
// ══════════════════════════════════════════════════════════════════════════

/** Una consulta concreta que legítimamente no filtra por tenant. */
export interface ExencionConsulta extends Exencion {
  /** El delegate de Prisma: `user`, `vehicle`, … */
  delegate: string;
}

export const CONSULTAS_SIN_TENANT: ExencionConsulta[] = [
  {
    archivo: 'admin/admin.service.ts',
    delegate: 'user',
    clase: 'permanente',
    motivo:
      'El panel GLOBAL de la plataforma lista usuarios de todos los tenants a ' +
      'propósito: `getAllUsers` y `getUsersWithPassInfo` existen justamente para ' +
      'eso. Filtrar por tenant sería lo contrario de su función. Están detrás de ' +
      'checkSuperAdmin().',
  },
];

// ══════════════════════════════════════════════════════════════════════════
// R7 · Rutas de escritura con `@Body()` sin DTO — CLIQUET, no lista blanca
// ══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ POR QUÉ UN CLIQUET Y NO UNA LISTA DE ARCHIVOS EXENTOS.
 *
 * El `ValidationPipe` sólo valida cuando el parámetro está tipado con una
 * CLASE: donde dice `@Body() data: any` el metatipo es `Object` y el pipe no
 * hace absolutamente nada. La Tanda 3 puso DTOs en las seis pantallas de
 * edición; medido hoy, quedan **41 rutas de escritura sin DTO en 19
 * controladores**.
 *
 * Corregirlas acá está fuera de alcance —esta tanda es cableado— y meter
 * cuarenta DTOs sin verificar cada campo contra el esquema real es exactamente
 * cómo se rompieron seis pantallas en la Tanda 3.
 *
 * Pero una lista blanca de ARCHIVOS sería inútil: `trips.controller.ts` está
 * exento, así que una ruta nueva sin DTO ahí entraría sin que nadie se entere,
 * que es justo lo que esta tanda viene a impedir.
 *
 * Por eso se congela el NÚMERO por controlador, y la comprobación es `<=`:
 *
 *   · agregar una ruta sin DTO  → el número sube  → **falla**
 *   · agregar un DTO            → el número baja  → pasa, y hay que bajar
 *                                                   el tope acá (la prueba lo dice)
 *
 * Es deuda que sólo puede achicarse. Los números salen de la medición, no de
 * una estimación: están abajo tal como los contó el barrido.
 */
export const TOPE_RUTAS_SIN_DTO: Record<string, number> = {
  'admin/admin.controller.ts': 6,
  'alerts/alerts.controller.ts': 1,
  'avl-users/avl-users.controller.ts': 3,
  'carbon/carbon.controller.ts': 1,
  'devices/devices.controller.ts': 1,
  'drivers/drivers.controller.ts': 1,
  'forwarding/forwarding.controller.ts': 2,
  'locations/locations.controller.ts': 2,
  'notifications/notifications.controller.ts': 2,
  'operational-protocols/operational-protocols.controller.ts': 1,
  'operations/operations.controller.ts': 2,
  'routes/routes.controller.ts': 2,
  'security-keys/security-keys.controller.ts': 2,
  'sensors/sensors.controller.ts': 1,
  'settings/settings.controller.ts': 3,
  'simulator/simulator.controller.ts': 3,
  'telemetry/telemetry.controller.ts': 1,
  'trips/trips.controller.ts': 6,
  'vehicles/vehicles.controller.ts': 1,
};

/**
 * `telemetry` merece una nota aparte: su `@Body() payload: any` es el punto de
 * entrada del HUB, cuyo formato lo define un tercero. Un DTO ahí no es
 * higiene, es una decisión de producto sobre qué se acepta de un proveedor
 * externo. Está en el cliquet igual, para que el número no suba.
 */

// ══════════════════════════════════════════════════════════════════════════
// R8 · Escrituras de `role_code` que no pasan por `exigirRolAsignable`
// ══════════════════════════════════════════════════════════════════════════

/** Un MÉTODO concreto, no un archivo: el archivo tiene otros que sí deben cumplir. */
export interface ExencionMetodo extends Exencion {
  metodo: string;
}

/**
 * ⚠️ La exención es por MÉTODO a propósito. `admin/admin.service.ts` contiene
 * `updateUserGlobal`, que es justamente la ruta por la que la escalada de la
 * Tanda 3 seguía pasando: eximir el ARCHIVO entero dejaría de vigilar el
 * método que más importa del proyecto.
 */
export const ESCRITURAS_ROL_SIN_REGLA: ExencionMetodo[] = [
  {
    archivo: 'admin/admin.service.ts',
    metodo: 'createTenant',
    clase: 'permanente',
    motivo:
      'El rol es una CONSTANTE del código (`role_code: \'account_owner\'`), no ' +
      'algo que elija quien llama: al crear un tenant, su primer usuario es su ' +
      'dueño por definición. `exigirRolAsignable` existe para impedir que el ' +
      'CALLER se conceda un rol; acá no hay caller que elegir nada, y el método ' +
      'ya está detrás de checkSuperAdmin().',
  },
];

// ══════════════════════════════════════════════════════════════════════════
// R16 · Importaciones sin usar — CLIQUET
// ══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ÉSTA ES LA FORMA DEL HALLAZGO QUE ORIGINÓ LA TANDA.
 *
 * `routes.findAll` importaba `tenantWhere` y no lo llamaba: el import decía
 * que la consulta estaba acotada por cliente y la consulta no lo estaba. `tsc`
 * no lo marca —un import sin usar no es un error de tipos—, ninguna prueba lo
 * ve, y el archivo se lee bien.
 *
 * Medido con `tsc --noUnusedLocals` como autoridad: quedan SIETE, en siete
 * archivos. Cada uno declara algo que el código no hace, y dos merecen mirarse:
 *
 *   · `sensors.controller.ts` importa `Put` y no tiene ninguna ruta `@Put`.
 *     El import es el fantasma de una pantalla de edición que se pensó y no se
 *     cableó — justo la pantalla que la Tanda 6 encontró cerrada desde afuera.
 *   · `forwarding.controller.ts` importa `ForbiddenException` sin usarla, en el
 *     MISMO archivo donde el `@Roles` estaba sin guard. Dos intenciones
 *     declaradas y no cumplidas en un solo archivo.
 *
 * No se corrigen acá: esta tanda es cableado, y borrar un import es tocar
 * siete módulos distintos. Se congela el número por archivo, igual que en R7:
 * sólo puede bajar.
 */
export const TOPE_IMPORTS_SIN_USAR: Record<string, number> = {
  'alerts/alerts.service.ts': 1,            // ForbiddenException
  'app.controller.ts': 1,                   // CurrentUser
  'forwarding/forwarding.controller.ts': 1, // ForbiddenException
  'locations/locations.service.ts': 1,      // Prisma
  'sensors/sensors.controller.ts': 1,       // Put
  'settings/settings.service.ts': 1,        // NotFoundException
  'users/users.service.ts': 1,              // Prisma
};

// ══════════════════════════════════════════════════════════════════════════
// Utilidades comunes a todas las listas
// ══════════════════════════════════════════════════════════════════════════

/** Los archivos exentos, para preguntar rápido. */
export const archivosDe = (lista: Exencion[]): Set<string> =>
  new Set(lista.map((e) => e.archivo));

/**
 * Exenciones que ya no corresponden a un archivo real.
 *
 * ⚠️ Es la mitad que se limpia sola. Si `forwarding.controller.ts` se renombra
 * y su exención queda apuntando al nombre viejo, la regla deja de eximir al
 * archivo nuevo… y también deja de aplicarse, porque nadie se entera. Con
 * esto, el barrido falla y obliga a revisar la exención.
 */
export const exencionesMuertas = (lista: Exencion[], reales: Set<string>): string[] =>
  lista.map((e) => e.archivo).filter((a) => !reales.has(a));

/** Las temporales, para listarlas en el reporte. */
export const deudaDeclarada = (lista: Exencion[]): Exencion[] =>
  lista.filter((e) => e.clase === 'temporal');
