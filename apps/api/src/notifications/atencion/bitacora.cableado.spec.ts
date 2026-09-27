import { BitacoraService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';
import { CampanaService } from '../despacho/campana.service';
import {
  motivoParaNoAtenderCritica,
  puedeCerrar,
  registroDiceAlgo,
  habilitaEscalada,
} from './tipos-atencion';

/**
 * LA BITÁCORA — que no se pueda silenciar sin decir qué se hizo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ LAS REVERSIONES QUE LA DEMUESTRAN — las tres que pediste, medidas
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   A · Dejar que se atienda SIN registrar
 *       (quitar el `await this.bitacora.validar(...)` de `CampanaService.atender`)
 *       → CAEN 2: «atender SIN resultado y SIN nota es rechazado» y «y NO se
 *       escribe nada».
 *
 *       ⚠️ Había escrito 4. Lo medí y son 2, y el número de menos dice algo:
 *       las otras dos que creía que caían —la del resultado de otro tipo y la
 *       de la transacción— prueban al SERVICIO de bitácora y no al camino de
 *       atender, así que sobreviven a que el camino deje de llamarlo. Es
 *       exactamente el reparto que conviene ver: la regla sigue probada y su
 *       aplicación no. Por eso las dos que caen son las que corren `atender`.
 *
 *   B · No aplicar el permiso de críticas
 *       (que `exigirPermisoSiEsCritica` devuelva sin comprobar)
 *       → CAEN 3: el rechazo, el «tampoco se escribe nada» y la que mira
 *       que la relectura haya corrido.
 *
 *       ⚠️ Eran 2 antes de la corrección. Subió a 3 porque la comprobación
 *       ahora deja rastro —la consulta a la base— y eso se puede mirar. Se
 *       deja escrito el número viejo para que el cambio se vea.
 *
 *   C · Dejar cerrar a cualquiera
 *       (que `puedeCerrar` devuelva siempre true)
 *       → CAEN 3: la de la función pura y las dos del servicio. Es la única
 *       de las tres que cae en los dos niveles, porque la regla es una sola
 *       función y el servicio la llama de verdad.
 *
 *   D · Que el permiso de críticas vuelva a salir del TOKEN
 *       (en `exigirPermisoSiEsCritica`, cambiar la relectura por
 *       `usuario.permissions`)
 *       → CAEN 4. Las pruebas están armadas con un token que MIENTE —dice
 *       tener el permiso cuando la base dice que no, y al revés— así que la
 *       vuelta al token no puede pasar desapercibida.
 *
 *   E · Que el destino de la escalada vuelva a filtrarse por NIVEL
 *       (`AND r.nivel_jerarquico > 0` en lugar de `AND r.recibe_escaladas`)
 *       → CAEN 2. Es el caso real: `gerencia` está en 70 y no entra al
 *       panel; filtrar por nivel le manda la alerta a él y no al jefe de
 *       flota, que está en 60 y es el que mira.
 *
 *   F · Que el CONTROLADOR vuelva al token mientras el servicio lee la base
 *       → CAEN 2. Es la discrepancia peor: el botón dice una cosa y la API
 *       hace otra. Se prueba aparte porque son dos puntas distintas y una
 *       sola de las dos puede revertirse sin tocar la otra.
 *
 * Medidas contra esta suite más el resto de `notifications`: 49 pruebas.
 *
 * ── Por qué las reglas se prueban DOS veces ───────────────────────────────
 *
 * Primero como funciones puras —`registroDiceAlgo`, `puedeCerrar`— y después
 * ejecutando el servicio. Es la lección que costó tres tandas: una prueba de
 * una función pura no prueba que alguien la llame. `recalcular()` tenía 31
 * pruebas propias y ningún llamador.
 */

const CLIENTE = '11111111-1111-1111-1111-111111111111';
const OTRO_CLIENTE = '22222222-2222-2222-2222-222222222222';
const OPERADOR = 'uuuu0001-0000-4000-8000-000000000001';
const GERENTE = 'uuuu0002-0000-4000-8000-000000000002';
const ALERTA = 'cccc0001-0000-4000-8000-000000000001';

// ════════════════════════════════════════════════════════════════════════
// LAS REGLAS, COMO FUNCIONES PURAS
// ════════════════════════════════════════════════════════════════════════

describe('Atención · registrar es obligatorio', () => {
  it('🔴 sin resultado y sin nota, la entrada NO dice nada', () => {
    expect(registroDiceAlgo({})).toBe(false);
    expect(registroDiceAlgo({ nota: null, resultado_codigo: null })).toBe(false);
  });

  it('🔴 un espacio NO es una nota', () => {
    // ⚠️ Es la forma de no decir nada que pasa cualquier validación escrita
    // sin cuidado, y es peor que dejarlo vacío: deja una fila que PARECE un
    // registro y tapa el hueco que la bitácora existe para mostrar.
    expect(registroDiceAlgo({ nota: '   ' })).toBe(false);
    expect(registroDiceAlgo({ nota: '\n\t ' })).toBe(false);
  });

  it('valen las dos vías: el catálogo o el texto libre', () => {
    expect(registroDiceAlgo({ resultado_codigo: 'NO_RESPONDE' })).toBe(true);
    expect(registroDiceAlgo({ nota: 'llamé y no atendió' })).toBe(true);
  });
});

describe('Atención · lo que habilita escalar sale de la FILA', () => {
  it('🔴 no se compara contra el código: se lee la columna', () => {
    // Si esto comparara contra `'NO_RESPONDE'`, el día que el cliente decida
    // que «Falla del GPS» también habilita escalar habría que desplegar.
    expect(habilitaEscalada({ habilita_escalada: true })).toBe(true);
    expect(habilitaEscalada({ habilita_escalada: false })).toBe(false);
    expect(habilitaEscalada(null)).toBe(false);
  });
});

describe('Atención · el botón se deshabilita CON EL MOTIVO, nunca se esconde', () => {
  it('🔴 sin el permiso, hay un motivo en castellano', () => {
    const motivo = motivoParaNoAtenderCritica({ permisos: ['view_alerts', 'manage_alerts'] });
    expect(motivo).toBeTruthy();
    expect(motivo).toContain('Alertas Críticas');
  });

  it('con el permiso, no hay motivo', () => {
    expect(motivoParaNoAtenderCritica({ permisos: ['manage_critical_alerts'] })).toBeNull();
    expect(motivoParaNoAtenderCritica({ permisos: ['*'] })).toBeNull();
    expect(motivoParaNoAtenderCritica({ permisos: [], esAdmin: true })).toBeNull();
  });
});

describe('Atención · cerrar es una facultad, no un nivel', () => {
  it('🔴 sale de la columna del rol y no de un umbral numérico', () => {
    // `nivel >= 60` sería el número mágico que esta serie viene sacando del
    // código desde la campana. Son dos preguntas: a quién se escala (orden) y
    // quién puede cerrar (política).
    expect(puedeCerrar({ puede_cerrar_alertas: true })).toBe(true);
    expect(puedeCerrar({ puede_cerrar_alertas: false })).toBe(false);
    expect(puedeCerrar(null)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Y AHORA, EJECUTANDO LOS SERVICIOS
// ════════════════════════════════════════════════════════════════════════

/** Un Prisma de mentira que anota SQL y valores, y responde por forma. */
function armarPrisma(respuestas: Record<string, unknown[]> = {}) {
  const llamadas: { sql: string; valores: unknown[] }[] = [];
  const responder = (sql: string): unknown[] => {
    for (const [clave, filas] of Object.entries(respuestas)) {
      if (sql.includes(clave)) return filas;
    }
    return [];
  };
  const prisma: any = {
    $queryRaw: jest.fn((s: TemplateStringsArray, ...v: unknown[]) => {
      const sql = s.join(' ? ');
      llamadas.push({ sql, valores: v });
      return Promise.resolve(responder(sql));
    }),
    $executeRaw: jest.fn((s: TemplateStringsArray, ...v: unknown[]) => {
      llamadas.push({ sql: s.join(' ? '), valores: v });
      return Promise.resolve(1);
    }),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma, llamadas };
}

const protocoloFalso = (over: Record<string, unknown> = {}) => ({
  paraTipo: jest.fn().mockResolvedValue({ tipo_condicion: 'SIN_REPORTE', pasos: [], resultados: [], propio_del_cliente: false }),
  resultadoDe: jest.fn().mockResolvedValue({
    codigo: 'NO_RESPONDE', nombre: 'No responde', orden: 3, habilita_escalada: true,
  }),
  pasoPertenece: jest.fn().mockResolvedValue(true),
  ...over,
});

describe('Bitácora · no se puede silenciar sin registrar', () => {
  function armarCampana(over: Record<string, unknown> = {}) {
    const { prisma, llamadas } = armarPrisma({
      'motor_tipos_condicion mt': [{ interrumpe: false }],
      'LEFT JOIN users u ON u.id = c.atendida_por': [
        { atendida_por: OPERADOR, nombre: 'Operador Demo', atendida_at: new Date() },
      ],
    });
    const bitacoraReal = new BitacoraService(prisma, protocoloFalso() as any);
    // El tipo de la alerta lo resuelve la bitácora contra la base; acá se fija.
    jest
      .spyOn(bitacoraReal, 'tipoDeAlerta')
      .mockResolvedValue({ tipo: 'SIN_REPORTE', cerrada: false });

    const campana = new CampanaService(
      prisma,
      { idsPermitidos: jest.fn().mockResolvedValue(null) } as any,
      { despacharAtencion: jest.fn().mockResolvedValue(1) } as any,
      bitacoraReal,
    );
    Object.assign(bitacoraReal, over);
    return { campana, bitacora: bitacoraReal, prisma, llamadas };
  }

  it('🔴 atender SIN resultado y SIN nota es rechazado', async () => {
    const { campana } = armarCampana();

    await expect(
      campana.atender(
        { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
        'condicion',
        ALERTA,
        {},
      ),
    ).rejects.toThrow(/Registrá qué hiciste/);
  });

  it('🔴 y NO se escribe nada: ni el silencio ni la entrada', async () => {
    // ⚠️ Es la parte que importa. Rechazar después de haber silenciado la
    // alerta dejaría exactamente el estado que esta etapa vino a eliminar.
    const { campana, llamadas } = armarCampana();

    await campana
      .atender(
        { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
        'condicion', ALERTA, { nota: '   ' },
      )
      .catch(() => undefined);

    expect(llamadas.some((l) => l.sql.includes('UPDATE trip_conditions'))).toBe(false);
    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(false);
  });

  it('🔴 con un resultado del catálogo, se escriben LAS DOS COSAS', async () => {
    const { campana, llamadas } = armarCampana();

    await campana.atender(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
      'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' },
    );

    expect(llamadas.some((l) => l.sql.includes('UPDATE trip_conditions'))).toBe(true);
    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(true);
  });

  it('🔴 y van en la MISMA transacción', async () => {
    // Un `atendida_at` sin su entrada es una alerta silenciada sin decir qué
    // se hizo; una entrada sin el silencio es una alarma que sigue sonando
    // después de haberla atendido. Las dos mitades o ninguna.
    const { campana, prisma } = armarCampana();

    await campana.atender(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
      'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('🔴 un resultado de OTRO tipo de alerta se rechaza', async () => {
    // `ACTIVACION_POLICIAL` existe en el catálogo —pertenece a SOS— así que
    // una comprobación que sólo mirara el código lo aceptaría, y la bitácora
    // diría que se activó a la policía por un camión detenido.
    const { prisma } = armarPrisma({ 'motor_tipos_condicion mt': [{ interrumpe: false }] });
    const bitacora = new BitacoraService(
      prisma,
      protocoloFalso({ resultadoDe: jest.fn().mockResolvedValue(null) }) as any,
    );

    await expect(
      bitacora.validar(CLIENTE, 'PARADA_PROLONGADA', { resultado_codigo: 'ACTIVACION_POLICIAL' }),
    ).rejects.toThrow(/no existe para este tipo/);
  });
});

describe('Bitácora · el permiso de las alertas críticas', () => {
  /**
   * ⚠️ LOS PERMISOS LOS SIRVE LA BASE, NO EL TOKEN.
   *
   * `permisosEnLaBase` alimenta la consulta de `permisosVigentesDe`; el token
   * que se le pasa a `atender` dice OTRA COSA a propósito. Si alguna de las
   * dos comprobaciones volviera a mirar `usuario.permissions`, estas pruebas
   * lo dicen: están armadas para que el token mienta.
   */
  function armarCritica(permisosEnLaBase: string[], critica = true) {
    const { prisma, llamadas } = armarPrisma({
      // `granted_permissions` sólo aparece en la consulta de permisos vigentes.
      granted_permissions: [{ permisos: permisosEnLaBase }],
      'motor_tipos_condicion mt': [{ interrumpe: critica }],
      'LEFT JOIN users u ON u.id = c.atendida_por': [
        { atendida_por: OPERADOR, nombre: 'Operador Demo', atendida_at: new Date() },
      ],
    });
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);
    jest.spyOn(bitacora, 'tipoDeAlerta').mockResolvedValue({ tipo: 'SIN_REPORTE', cerrada: false });
    const campana = new CampanaService(
      prisma,
      { idsPermitidos: jest.fn().mockResolvedValue(null) } as any,
      { despacharAtencion: jest.fn().mockResolvedValue(1) } as any,
      bitacora,
    );
    return { campana, llamadas };
  }

  /** Un token que afirma tener TODO. Lo que vale es la base. */
  const TOKEN_MENTIROSO = {
    id: OPERADOR,
    tenantId: CLIENTE,
    role: 'operator',
    permissions: ['manage_alerts', 'manage_critical_alerts'],
  };

  it('🔴 sin el permiso EN LA BASE, atender una CRÍTICA se rechaza con el motivo', async () => {
    // El token dice que lo tiene. La base dice que no. Manda la base.
    const { campana } = armarCritica(['manage_alerts']);

    await expect(
      campana.atender(TOKEN_MENTIROSO, 'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' }),
    ).rejects.toThrow(/Alertas Críticas/);
  });

  it('🔴 y tampoco se escribe nada', async () => {
    const { campana, llamadas } = armarCritica(['manage_alerts']);

    await campana
      .atender(TOKEN_MENTIROSO, 'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' })
      .catch(() => undefined);

    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(false);
  });

  it('🔴 con el permiso recién otorgado, la misma alerta se atiende SIN volver a entrar', async () => {
    // ⚠️ Este es el caso que la relectura resuelve: el supervisor otorga
    // `manage_critical_alerts` desde Gestión de Usuarios y el token del
    // operador —firmado antes— no lo tiene. Si la comprobación mirara el
    // token, tendría que cerrar sesión y volver a entrar con una alerta
    // crítica viva en la pantalla.
    const { campana, llamadas } = armarCritica(['manage_alerts', 'manage_critical_alerts']);

    await campana.atender(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
      'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' },
    );

    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(true);
  });

  it('🔴 y la comprobación LEE LA BASE de verdad', async () => {
    // Sin esto, las tres de arriba pasarían igual con una relectura que
    // devolviera siempre lo mismo. Acá se mira que la consulta haya corrido.
    const { campana, llamadas } = armarCritica(['manage_alerts', 'manage_critical_alerts']);

    await campana.atender(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: [] },
      'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' },
    );

    const consulta = llamadas.find((l) => l.sql.includes('granted_permissions'))!;
    expect(consulta).toBeDefined();
    expect(consulta.sql).toContain('revoked_permissions');
    expect(consulta.valores).toEqual(expect.arrayContaining([OPERADOR]));
  });

  it('en una alerta que NO es crítica, ni se consulta el permiso', async () => {
    // ⚠️ No es sólo ahorrar una consulta: exigir el permiso para todas
    // dejaría a un operador común sin poder atender una parada prolongada.
    const { campana, llamadas } = armarCritica([], false);

    await campana.atender(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: ['manage_alerts'] },
      'condicion', ALERTA, { resultado_codigo: 'NO_RESPONDE' },
    );

    expect(llamadas.some((l) => l.sql.includes('granted_permissions'))).toBe(false);
    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(true);
  });
});

describe('Bitácora · cerrar es de quien tiene la facultad', () => {
  function armarCierre(rol: { puede_cerrar_alertas: boolean; nivel_jerarquico: number } | null) {
    const { prisma, llamadas } = armarPrisma({
      'FROM roles r WHERE r.code': rol ? [rol] : [],
    });
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);
    jest.spyOn(bitacora, 'tipoDeAlerta').mockResolvedValue({ tipo: 'SIN_REPORTE', cerrada: false });
    return { bitacora, llamadas, prisma };
  }

  it('🔴 un operador común NO puede cerrar', async () => {
    const { bitacora } = armarCierre({ puede_cerrar_alertas: false, nivel_jerarquico: 30 });

    await expect(
      bitacora.cerrar(
        { id: OPERADOR, tenantId: CLIENTE, role: 'operator' },
        'condicion', ALERTA, 'porque sí',
      ),
    ).rejects.toThrow(/no puede cerrar/);
  });

  it('🔴 y el rechazo le dice qué SÍ puede hacer', async () => {
    // Un «no podés» a secas deja al operador sin salida con una alerta viva
    // en la pantalla. El mensaje nombra las dos que sí tiene.
    const { bitacora } = armarCierre({ puede_cerrar_alertas: false, nivel_jerarquico: 30 });

    await expect(
      bitacora.cerrar({ id: OPERADOR, tenantId: CLIENTE, role: 'operator' }, 'condicion', ALERTA, 'x'),
    ).rejects.toThrow(/escalala/);
  });

  it('🔴 quien puede cerrar, TIENE que escribir el motivo', async () => {
    const { bitacora } = armarCierre({ puede_cerrar_alertas: true, nivel_jerarquico: 60 });

    await expect(
      bitacora.cerrar({ id: GERENTE, tenantId: CLIENTE, role: 'manager' }, 'condicion', ALERTA, '   '),
    ).rejects.toThrow(/motivo/);
  });

  it('con la facultad y el motivo, cierra y deja la entrada', async () => {
    const { bitacora, llamadas } = armarCierre({ puede_cerrar_alertas: true, nivel_jerarquico: 60 });

    await bitacora.cerrar(
      { id: GERENTE, tenantId: CLIENTE, role: 'manager' },
      'condicion', ALERTA, 'el cliente confirmó que el viaje siguió normal',
    );

    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(true);
    // ⚠️ Se escribe `fin`, la MISMA columna que usa el motor al cerrar solo:
    // con eso la campana deja de mostrarla y el estado de la 3A se recalcula,
    // sin vocabulario nuevo.
    expect(llamadas.some((l) => l.sql.includes('SET fin = coalesce(fin, now())'))).toBe(true);
  });
});

describe('Bitácora · escalar es una acción más, no el cierre', () => {
  function armarEscalada(destino: unknown[] = [
    { usuario_id: GERENTE, nombre: 'Gerente Demo', email: 'g@demo', role_code: 'manager', nivel_jerarquico: 60 },
  ]) {
    const { prisma, llamadas } = armarPrisma({ 'JOIN roles r ON r.code = u.role_code': destino });
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);
    jest.spyOn(bitacora, 'tipoDeAlerta').mockResolvedValue({ tipo: 'SIN_REPORTE', cerrada: false });
    return { bitacora, llamadas };
  }

  it('🔴 escalar NO cierra la alerta', async () => {
    // Si cerrara, el operador tendría un botón para hacer desaparecer lo que
    // no puede resolver. Escalar es pedir ayuda, no sacárselo de encima.
    const { bitacora, llamadas } = armarEscalada();

    await bitacora.escalar(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator' }, 'condicion', ALERTA, 'no atiende',
    );

    expect(llamadas.some((l) => l.sql.includes('INSERT INTO trip_condition_bitacora'))).toBe(true);
    expect(llamadas.some((l) => l.sql.includes('SET fin'))).toBe(false);
    expect(llamadas.some((l) => l.sql.includes("SET status = 'resolved'"))).toBe(false);
  });

  it('🔴 el destino sale de la JERARQUÍA, no del cuerpo de la petición', async () => {
    const { bitacora, llamadas } = armarEscalada();

    const { destino } = await bitacora.escalar(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator' }, 'condicion', ALERTA, null,
    );

    expect(destino.usuario_id).toBe(GERENTE);
    const consulta = llamadas.find((l) => l.sql.includes('JOIN roles r ON r.code = u.role_code'));
    expect(consulta!.sql).toContain('r.recibe_escaladas');
    expect(consulta!.sql).toContain('ORDER BY r.nivel_jerarquico DESC');
    // Y se excluye a quien escala: escalarse a sí mismo es una entrada que no
    // mueve nada y parece que sí.
    expect(consulta!.sql).toContain('u.id <> ');
    expect(consulta!.valores).toEqual(expect.arrayContaining([CLIENTE, OPERADOR]));
  });

  it('🔴 se filtra por QUIÉN MIRA y se ordena por QUIÉN MANDA — dos columnas', async () => {
    // ⚠️ El caso real: `gerencia` está en 70 y `manager` en 60, y el que hay
    // que despertar a las tres de la mañana es el segundo, porque es el que
    // entra al panel. Si el WHERE mirara el nivel, la alerta iría al gerente
    // —más alto, y ausente— y se perdería. El nivel ordena entre los que
    // reciben; no decide quién recibe.
    const { bitacora, llamadas } = armarEscalada();

    await bitacora.escalar(
      { id: OPERADOR, tenantId: CLIENTE, role: 'operator' }, 'condicion', ALERTA, null,
    );

    const consulta = llamadas.find((l) => l.sql.includes('JOIN roles r ON r.code = u.role_code'))!;
    // ⚠️ Se recorta el WHERE y no el SELECT: el nivel SÍ viaja en la lista
    // de columnas —la pantalla lo muestra— y compararlo ahí daría un falso
    // positivo. Lo que esta prueba mira es la condición.
    const filtro = consulta.sql.split('WHERE')[1].split('ORDER BY')[0];
    const orden = consulta.sql.split('ORDER BY')[1];
    expect(filtro).toContain('r.recibe_escaladas');
    expect(filtro).not.toContain('nivel_jerarquico');
    expect(orden).toContain('nivel_jerarquico DESC');
  });

  it('🔴 sin nadie a quien escalar, lo dice — no falla en silencio', async () => {
    const { bitacora } = armarEscalada([]);

    await expect(
      bitacora.escalar({ id: OPERADOR, tenantId: CLIENTE, role: 'operator' }, 'condicion', ALERTA, null),
    ).rejects.toThrow(/No hay a quién escalar/);
  });
});

describe('Bitácora · el aislamiento del hilo', () => {
  it('🔴 el hilo de un cliente NO se ve desde otro', async () => {
    // ⚠️ La alerta se resuelve SIEMPRE acotada por cliente, y sin tipo no hay
    // hilo: no es una comprobación aparte que alguien pueda olvidar de
    // encadenar, es el único camino.
    const { prisma } = armarPrisma({});
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);

    await expect(bitacora.hilo(OTRO_CLIENTE, 'condicion', ALERTA)).rejects.toThrow(
      /no existe o no es visible/,
    );
  });

  it('🔴 y cuando sí es visible, la consulta del hilo acota por cliente', async () => {
    const { prisma, llamadas } = armarPrisma({
      'FROM trip_conditions c': [{ tipo: 'SIN_REPORTE', cerrada: false }],
    });
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);

    await bitacora.hilo(CLIENTE, 'condicion', ALERTA);

    const consulta = llamadas.find((l) => l.sql.includes('FROM trip_condition_bitacora b'));
    expect(consulta).toBeDefined();
    // Por VALOR ENLAZADO y no por el texto: la prueba de la 3A que buscaba la
    // palabra `tenant_id` no falló al quitar el filtro.
    expect(consulta!.valores).toEqual(expect.arrayContaining([CLIENTE, ALERTA]));
  });
});

describe('Bitácora · la pantalla y la API miran EL MISMO LUGAR', () => {
  /**
   * ⚠️ La punta que arma el botón también relee la base.
   *
   * Si el controlador leyera el token y el servicio la base, el botón
   * quedaría habilitado con un motivo en `null` y la API lo rechazaría al
   * tocarlo —o al revés: deshabilitado con motivo sobre una acción que sí
   * podía hacer. Las dos son peores que no tener el permiso: el operador ve
   * una cosa y el sistema hace otra.
   */
  function armarControlador(permisosEnLaBase: string[]) {
    const { prisma, llamadas } = armarPrisma({
      granted_permissions: [{ permisos: permisosEnLaBase }],
      'FROM roles r WHERE r.code': [
        { puede_cerrar_alertas: false, nivel_jerarquico: 30, recibe_escaladas: false },
      ],
      'JOIN roles r ON r.code = u.role_code': [
        { usuario_id: GERENTE, nombre: 'Gerente Demo', email: 'g@demo', role_code: 'manager', nivel_jerarquico: 60 },
      ],
    });
    const bitacora = new BitacoraService(prisma, protocoloFalso() as any);
    jest.spyOn(bitacora, 'tipoDeAlerta').mockResolvedValue({ tipo: 'SIN_REPORTE', cerrada: false });
    return { controlador: new BitacoraController(bitacora, protocoloFalso() as any), llamadas };
  }

  /** Igual que en el servicio: el token afirma tenerlo todo. */
  const REQ = {
    user: {
      id: OPERADOR, tenantId: CLIENTE, role: 'operator',
      permissions: ['manage_alerts', 'manage_critical_alerts'],
    },
  };

  it('🔴 el motivo que viaja a la pantalla sale de la BASE, no del token', async () => {
    const { controlador } = armarControlador(['manage_alerts']);

    const respuesta: any = await controlador.protocoloDe(REQ, ALERTA, 'condicion');

    expect(respuesta.motivo_sin_permiso_critica).toContain('Alertas Críticas');
  });

  it('con el permiso en la base, no hay motivo — aunque el token no lo traiga', async () => {
    const { controlador } = armarControlador(['manage_alerts', 'manage_critical_alerts']);

    const respuesta: any = await controlador.protocoloDe(
      { user: { id: OPERADOR, tenantId: CLIENTE, role: 'operator', permissions: [] } },
      ALERTA,
      'condicion',
    );

    expect(respuesta.motivo_sin_permiso_critica).toBeNull();
  });

  it('🔴 y el destino que se le muestra al operador es el MISMO que usa escalar', async () => {
    // ⚠️ Es la misma función, y por eso esta prueba mira que sea la misma
    // consulta: mostrar un destino y escribir otro es peor que no mostrarlo.
    const { controlador, llamadas } = armarControlador(['manage_alerts']);

    const respuesta: any = await controlador.protocoloDe(REQ, ALERTA, 'condicion');

    expect(respuesta.destino_de_escalada.usuario_id).toBe(GERENTE);
    const consulta = llamadas.find((l) => l.sql.includes('JOIN roles r ON r.code = u.role_code'))!;
    expect(consulta.sql).toContain('r.recibe_escaladas');
  });
});
