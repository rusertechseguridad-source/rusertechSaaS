import { CampanaService } from './campana.service';
import { CanalCampanaService } from './canal-campana.service';
import type { MensajeDeCanal } from './tipos-despacho';

/**
 * AISLAMIENTO DE LA CAMPANA — que nadie oiga lo que no puede ver.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTO NECESITA SU PROPIA SUITE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un flujo en vivo es una fuga de datos con otra forma. La pantalla de alertas
 * ya filtra por cliente y por vehículo —`AlertsService.findAll` lo hace desde
 * la Tanda 7— pero un canal que empuja avisos es un camino NUEVO hacia los
 * mismos datos, y los caminos nuevos son donde el aislamiento se olvida.
 *
 * Son dos límites distintos y los dos se prueban acá:
 *
 *   1. **Por cliente.** Un aviso del cliente A no puede aparecer en la
 *      pantalla de alguien del cliente B. Nunca, por ninguna vía.
 *   2. **Por vehículo.** Dentro del mismo cliente, un operador restringido a
 *      tres camiones no puede escuchar la alerta de los otros ciento veinte.
 *      Es el defecto exacto que la Tanda 7 encontró en la pantalla de alertas
 *      —«veía las alertas de los 120»— y que acá podría volver por la puerta
 *      de atrás.
 *
 * ⚠️ Y una tercera cosa, que es la que se olvida: **la lista y el flujo tienen
 * que usar la MISMA decisión**. Si se calcularan por separado, un operador
 * podría no ver una alerta en la lista y escucharla igual — o al revés. Por
 * eso `CampanaService.vehiculosVisibles` es un solo método y lo llaman los dos.
 */

const CLIENTE_A = '11111111-1111-1111-1111-111111111111';
const CLIENTE_B = '22222222-2222-2222-2222-222222222222';
const CAMION_MIO = 'aaaa0001-0000-4000-8000-000000000001';
const CAMION_AJENO = 'aaaa0002-0000-4000-8000-000000000002';

const avisoDe = (tenant: string, vehiculo: string): MensajeDeCanal => ({
  clase: 'nuevo',
  aviso: {
    fuente: 'condicion', id: 'x', tenant_id: tenant, vehicle_id: vehiculo,
    trip_id: null, tipo: 'SIN_REPORTE', titulo: 'Sin reporte',
    nivel_riesgo: 'riesgo_critico', color: '#EF4444',
    interrumpe: true, requiere_atencion: true, clasificado: true,
    ocurrio_at: new Date(), patente: 'DEMO-001',
    latitud: null, longitud: null, direccion: null, disparador: null,
  },
});

/**
 * Escucha un flujo y devuelve lo que le fue llegando.
 *
 * ⚠️ LAS SUSCRIPCIONES SE CIERRAN EN `afterEach`, NO AL FINAL DE CADA PRUEBA.
 *
 * Lo descubrí midiendo, y es un defecto que tenía esta misma suite: el flujo
 * incluye un latido con `timer(25s)`, así que una suscripción viva mantiene un
 * temporizador abierto. Con el `unsubscribe()` al final del cuerpo, **una
 * prueba que falla nunca llega a esa línea** y jest se queda colgado esperando
 * el temporizador — durante una reversión, que es justo cuando hace falta ver
 * el resultado. Una suite que se cuelga cuando algo falla es una suite que se
 * deja de correr.
 */
const abiertas: { unsubscribe(): void }[] = [];
afterEach(() => {
  while (abiertas.length > 0) abiertas.pop()!.unsubscribe();
});

function escuchar(canal: CanalCampanaService, tenant: string, vehiculos: string[] | null) {
  const recibidos: { type: string; data: string }[] = [];
  const sub = canal.flujoPara(tenant, vehiculos).subscribe((e) => recibidos.push(e));
  abiertas.push(sub);
  return { recibidos, cortar: () => sub.unsubscribe() };
}

describe('Campana · el aislamiento entre clientes', () => {
  it('🔴 un aviso del cliente A NO llega a una pantalla del cliente B', () => {
    const canal = new CanalCampanaService();
    const a = escuchar(canal, CLIENTE_A, null);
    const b = escuchar(canal, CLIENTE_B, null);

    canal.entregar(avisoDe(CLIENTE_A, CAMION_MIO));

    expect(a.recibidos).toHaveLength(1);
    expect(b.recibidos).toHaveLength(0);

    a.cortar();
    b.cortar();
  });

  it('🔴 los flujos son independientes: cada cliente tiene el suyo', () => {
    const canal = new CanalCampanaService();
    const a = escuchar(canal, CLIENTE_A, null);
    const b = escuchar(canal, CLIENTE_B, null);

    canal.entregar(avisoDe(CLIENTE_B, CAMION_MIO));

    expect(a.recibidos).toHaveLength(0);
    expect(b.recibidos).toHaveLength(1);
    expect(canal.clientesConFlujo()).toBe(2);

    a.cortar();
    b.cortar();
  });
});

describe('Campana · el aislamiento por vehículo, dentro del mismo cliente', () => {
  it('🔴 un operador restringido NO recibe la alerta de un camión ajeno', () => {
    const canal = new CanalCampanaService();
    const limitado = escuchar(canal, CLIENTE_A, [CAMION_MIO]);
    const sinLimite = escuchar(canal, CLIENTE_A, null);

    canal.entregar(avisoDe(CLIENTE_A, CAMION_AJENO));

    expect(limitado.recibidos).toHaveLength(0);
    // El mismo aviso, en el mismo cliente, sí le llega a quien no tiene límite:
    // es lo que distingue «el filtro funciona» de «el flujo está roto».
    expect(sinLimite.recibidos).toHaveLength(1);

    limitado.cortar();
    sinLimite.cortar();
  });

  it('🔴 sí recibe la de SU camión', () => {
    const canal = new CanalCampanaService();
    const limitado = escuchar(canal, CLIENTE_A, [CAMION_MIO]);

    canal.entregar(avisoDe(CLIENTE_A, CAMION_MIO));

    expect(limitado.recibidos).toHaveLength(1);
    limitado.cortar();
  });

  it('🔴 una lista VACÍA significa «ninguno», no «todos»', () => {
    // ⚠️ Es la confusión que deja fugas: un arreglo vacío leído como «sin
    // restricción» le mostraría todo al usuario que no puede ver nada. El
    // servicio de accesos lo documenta y acá se fija.
    const canal = new CanalCampanaService();
    const sinNada = escuchar(canal, CLIENTE_A, []);

    canal.entregar(avisoDe(CLIENTE_A, CAMION_MIO));

    expect(sinNada.recibidos).toHaveLength(0);
    sinNada.cortar();
  });
});

describe('Campana · la lista y el flujo usan la MISMA decisión', () => {
  function armar(idsPermitidos: string[] | null) {
    const acceso = { idsPermitidos: jest.fn().mockResolvedValue(idsPermitidos) };
    const llamadas: any[][] = [];
    // ⚠️ SE ANOTAN LAS DOS VÍAS. La lectura va por `$queryRaw` y la escritura
    // de `atender` por `$executeRaw`: anotar sólo una dejaba la prueba del
    // aislamiento de la ESCRITURA mirando un arreglo vacío y pasando por
    // vacía. Es el mismo error de mirar el lugar equivocado que esta serie
    // viene cazando, ahora en mi propia prueba.
    const anotar = (devuelve: any) =>
      jest.fn((s: TemplateStringsArray, ...v: any[]) => {
        llamadas.push([s.join(' ? '), ...v]);
        return Promise.resolve(devuelve);
      });
    const prisma = { $queryRaw: anotar([]), $executeRaw: anotar(1) };
    const despacho = { despacharAtencion: jest.fn().mockResolvedValue(1) };
    return {
      servicio: new CampanaService(prisma as any, acceso as any, despacho as any),
      acceso, llamadas, despacho,
    };
  }

  it('🔴 la lista pregunta por los vehículos permitidos', async () => {
    const { servicio, acceso } = armar([CAMION_MIO]);

    await servicio.pendientes({ id: 'u1', tenantId: CLIENTE_A, role: 'operator' });

    expect(acceso.idsPermitidos).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'vehicles',
    );
  });

  it('🔴 el cliente viaja como VALOR ENLAZADO, no como texto de la consulta', async () => {
    // Por valor y no por texto: la prueba de la 3A que buscaba la palabra
    // `tenant_id` en el SQL no falló al quitar el filtro, porque la palabra
    // seguía apareciendo en otro lado. Un valor enlazado no se puede fingir.
    const { servicio, llamadas } = armar(null);

    await servicio.pendientes({ id: 'u1', tenantId: CLIENTE_A, role: 'operator' });

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].slice(1)).toEqual(expect.arrayContaining([CLIENTE_A]));
  });

  it('🔴 la restricción por vehículo viaja a la consulta, no se aplica después', async () => {
    // Filtrar en memoria después de traer todo sería traer todo: las filas de
    // los otros camiones habrían salido de la base igual.
    const { servicio, llamadas } = armar([CAMION_MIO]);

    await servicio.pendientes({ id: 'u1', tenantId: CLIENTE_A, role: 'operator' });

    const [sql, ...valores] = llamadas[0];
    expect(sql).toContain('= ANY(');
    expect(valores).toEqual(expect.arrayContaining([[CAMION_MIO]]));
    // Y el booleano de «sin límite» viaja en falso: si viajara en true, el
    // `OR` de la consulta abriría el filtro entero.
    expect(valores).toEqual(expect.arrayContaining([false]));
  });

  it('🔴 sin cliente en la sesión no se consulta NADA', async () => {
    // Fallar en cerrado. Un `tenantId` indefinido que llegara a la consulta
    // haría `tenant_id = NULL`, que no devuelve filas por casualidad y no por
    // diseño — y una consulta escrita distinto sí las devolvería.
    const { servicio, llamadas } = armar(null);

    await expect(servicio.pendientes({ id: 'u1', role: 'operator' })).rejects.toThrow();
    expect(llamadas).toHaveLength(0);
  });

  it('🔴 atender también acota por cliente Y por vehículo', async () => {
    // La escritura es el camino más caro de olvidar: marcar como atendida la
    // alerta de otro cliente es peor que verla.
    const { servicio, llamadas, despacho } = armar([CAMION_MIO]);

    await servicio
      .atender({ id: 'u1', tenantId: CLIENTE_A, role: 'operator' }, 'condicion', 'cond-1', null)
      .catch(() => undefined);

    const escritura = llamadas.find((l) => String(l[0]).includes('UPDATE trip_conditions'));
    expect(escritura).toBeDefined();
    expect(escritura!.slice(1)).toEqual(expect.arrayContaining([CLIENTE_A, [CAMION_MIO]]));
    // Sin fila atendida no se despacha nada: no se avisa de algo que no pasó.
    expect(despacho.despacharAtencion).not.toHaveBeenCalled();
  });
});
