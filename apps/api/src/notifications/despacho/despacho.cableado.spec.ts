import { CondicionesService } from '../../motor/condiciones/condiciones.service';
import { DespachoService } from './despacho.service';
import { CanalCampanaService } from './canal-campana.service';
import type { CanalDeAviso, MensajeDeCanal } from './tipos-despacho';

/**
 * CABLEADO DEL DESPACHO — que la alerta SALGA del motor.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA SUITE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Es la tercera vez en esta serie que hace falta una prueba así, y las dos
 * anteriores fueron por defectos reales:
 *
 *   3A · `recalcular()` existía, tenía 31 pruebas propias y NADIE lo llamaba.
 *   3B bis · `ultimo_punto` se leía y NADIE la escribía.
 *
 * Las dos invisibles a `tsc` y a las pruebas de unidad. Acá el riesgo es el
 * mismo con otra cara: un `DespachoService` perfecto, probado, y el motor sin
 * llamarlo. El operador seguiría sin enterarse de nada, con todo en verde.
 *
 * Corre el `CondicionesService` DE VERDAD, con un Prisma que devuelve los ids
 * del `RETURNING`, y mira qué le llegó al canal del otro extremo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ LA REVERSIÓN QUE LA DEMUESTRA — verificada, no supuesta
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   Quitar `await this.despacho.despacharCondiciones(abiertas)` de
 *   `CondicionesService.aplicar` → CAEN 8: las siete de esta suite que pasan
 *   por `aplicar`, más **R19**. `tsc` sigue en cero y las 483 pruebas
 *   anteriores a esta tanda siguen verdes, que es exactamente el punto.
 *
 *   ⚠️ Había escrito «caen 3». Lo medí y son 8. Lo dejo corregido y no
 *   reescrito en silencio porque el número importa: es la diferencia entre
 *   creer que una reversión toca una esquina y ver cuánto se apoya en ella.
 *
 *   ⚠️ Y una cosa que NO cae: **R17**. La regla que existe justamente para
 *   cazar «esto está escrito y nadie lo llama» se queda en verde, porque su
 *   definición de «escribir» son escrituras en la base y el despacho no
 *   escribe en la base. Por eso esta tanda agrega R19, que sí cae. Lo digo
 *   acá porque el encargo daba por hecho que R17 lo iba a vigilar, y no.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const VIAJE = 'dddd0001-0000-4000-8000-000000000001';
const T0 = new Date('2026-09-21T12:00:00Z');

/** Un canal de mentira que sólo anota. Es lo que un Telegram va a ser. */
class CanalDePrueba implements CanalDeAviso {
  readonly nombre = 'prueba';
  readonly recibidos: MensajeDeCanal[] = [];
  entregar(mensaje: MensajeDeCanal): void {
    this.recibidos.push(mensaje);
  }
}

/** La fila que devuelve la consulta de enriquecimiento del despacho. */
const filaDeAviso = (over: Record<string, unknown> = {}) => ({
  id: 'cond-1',
  tenant_id: TENANT,
  vehicle_id: VEHICULO,
  trip_id: VIAJE,
  tipo: 'SIN_REPORTE',
  titulo: 'Sin reporte',
  nivel_riesgo: 'riesgo_critico',
  color: '#EF4444',
  interrumpe_al_operador: true,
  requiere_atencion_operador: true,
  ocurrio_at: T0,
  patente: 'DEMO-001',
  latitud: null,
  longitud: null,
  direccion: null,
  disparador: '50 minutos sin reportar',
  ...over,
});

function armar(filas: Record<string, unknown>[] = [filaDeAviso()]) {
  const sql: string[] = [];
  const prisma = {
    // El INSERT de `abrir` devuelve los ids que creó; la consulta que arma los
    // avisos devuelve las filas enriquecidas. El despacho de esas dos cosas es
    // lo que esta suite vigila.
    $queryRaw: jest.fn((s: TemplateStringsArray) => {
      const texto = s.join(' ? ');
      sql.push(texto);
      if (texto.includes('INSERT INTO trip_conditions')) {
        return Promise.resolve([{ id: 'cond-1' }]);
      }
      if (texto.includes('LEFT JOIN motor_niveles_riesgo')) {
        return Promise.resolve(filas);
      }
      // El UPDATE de `cerrar` también devuelve ids desde la 1ª de
      // notificaciones: es lo que permite avisar «esto ya no suena».
      if (texto.includes('UPDATE trip_conditions')) {
        return Promise.resolve([{ id: 'cond-1' }]);
      }
      return Promise.resolve([]);
    }),
    $executeRaw: jest.fn(() => Promise.resolve(1)),
  };

  const canal = new CanalDePrueba();
  const despacho = new DespachoService(prisma as any, [canal]);
  const condiciones = new CondicionesService(prisma as any, despacho);
  return { condiciones, despacho, canal, prisma, sql };
}

const abrir = (over: Record<string, unknown> = {}) => ({
  accion: 'abrir' as const,
  tipo: 'SIN_REPORTE' as const,
  tenant_id: TENANT,
  vehicle_id: VEHICULO,
  trip_id: VIAJE,
  inicio: T0,
  disparador: '50 minutos sin reportar',
  datos: {},
  ...over,
});

describe('Despacho · la alerta sale del motor', () => {
  it('🔴 una condición abierta LLEGA al canal', async () => {
    const { condiciones, canal } = armar();

    await condiciones.aplicar([abrir()]);

    expect(canal.recibidos).toHaveLength(1);
    expect(canal.recibidos[0].clase).toBe('nuevo');
  });

  it('🔴 240 evaluaciones del mismo hecho producen UN aviso', async () => {
    // ⚠️ La idempotencia se HEREDA del `WHERE NOT EXISTS`, no se rehace acá.
    // El Prisma de prueba devuelve fila sólo para la primera: es lo que hace
    // la base cuando la clave de identidad ya existe.
    const sql: string[] = [];
    let insertos = 0;
    const prisma = {
      $queryRaw: jest.fn((s: TemplateStringsArray) => {
        const texto = s.join(' ? ');
        sql.push(texto);
        if (texto.includes('INSERT INTO trip_conditions')) {
          insertos += 1;
          return Promise.resolve(insertos === 1 ? [{ id: 'cond-1' }] : []);
        }
        if (texto.includes('LEFT JOIN motor_niveles_riesgo')) {
          return Promise.resolve([filaDeAviso()]);
        }
        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn(() => Promise.resolve(1)),
    };
    const canal = new CanalDePrueba();
    const condiciones = new CondicionesService(
      prisma as any,
      new DespachoService(prisma as any, [canal]),
    );

    await condiciones.aplicar(
      Array.from({ length: 240 }, (_, i) => abrir({ disparador: `evaluación ${i}` })),
    );

    // El INSERT se intentó 240 veces —es el motor haciendo su trabajo— y el
    // aviso salió UNA. Si sonara 240 veces, el operador apagaría la campana.
    expect(insertos).toBe(240);
    expect(canal.recibidos).toHaveLength(1);
  });

  it('🔴 el motor no sabe qué canales hay — le entrega al despacho y listo', async () => {
    // Es la prueba de que la entrega 2 no va a tener que abrir el motor:
    // DOS canales registrados, y el motor sigue llamando a un solo lugar.
    const canalA = new CanalDePrueba();
    const canalB = new CanalDePrueba();
    const prisma = {
      $queryRaw: jest.fn((s: TemplateStringsArray) => {
        const texto = s.join(' ? ');
        if (texto.includes('INSERT INTO trip_conditions')) return Promise.resolve([{ id: 'c' }]);
        if (texto.includes('LEFT JOIN motor_niveles_riesgo')) return Promise.resolve([filaDeAviso()]);
        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn(() => Promise.resolve(1)),
    };
    const despacho = new DespachoService(prisma as any, [canalA, canalB]);
    const condiciones = new CondicionesService(prisma as any, despacho);

    await condiciones.aplicar([abrir()]);

    // Los DOS recibieron el mismo aviso, y el motor llamó a un solo lugar.
    expect(canalA.recibidos).toHaveLength(1);
    expect(canalB.recibidos).toHaveLength(1);
    expect(canalA.recibidos[0]).toEqual(canalB.recibidos[0]);
  });

  it('🔴 cerrar una condición avisa que ya no suena', async () => {
    // «Si la condición se cierra sola, la alerta deja de sonar y pasa a
    // resuelta, pero queda en el historial.»
    const { condiciones, canal } = armar();

    await condiciones.aplicar([
      { ...abrir(), accion: 'cerrar', fin: new Date(), disparador: 'volvió a reportar' },
    ]);

    expect(canal.recibidos).toHaveLength(1);
    expect(canal.recibidos[0].clase).toBe('resuelto');
  });

  it('🔴 un canal que revienta NO tumba al motor', async () => {
    // El hecho ya está escrito cuando esto corre: la campana lo va a mostrar
    // igual al reconstruirse desde la base. Dejar subir la excepción marcaría
    // el lote como fallido y lo reprocesaría — castigar al motor por un
    // problema del mensajero.
    const roto: CanalDeAviso = {
      nombre: 'roto',
      entregar() { throw new Error('el mensajero se cayó'); },
    };
    const bueno = new CanalDePrueba();
    const prisma = {
      $queryRaw: jest.fn((s: TemplateStringsArray) => {
        const texto = s.join(' ? ');
        if (texto.includes('INSERT INTO trip_conditions')) return Promise.resolve([{ id: 'c' }]);
        if (texto.includes('LEFT JOIN motor_niveles_riesgo')) return Promise.resolve([filaDeAviso()]);
        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn(() => Promise.resolve(1)),
    };
    const condiciones = new CondicionesService(
      prisma as any,
      new DespachoService(prisma as any, [roto, bueno]),
    );

    await expect(condiciones.aplicar([abrir()])).resolves.toBe(1);
    // Y el canal sano recibió igual: uno caído no arrastra a los demás.
    expect(bueno.recibidos).toHaveLength(1);
  });
});

describe('Despacho · la gravedad sale del catálogo, nunca del código', () => {
  it('🔴 lo que interrumpe lo dice la columna, no un número de orden', async () => {
    // ⚠️ `if (orden >= 30)` es lo que esta prueba prohíbe. Con la MISMA fila y
    // sólo cambiando la columna del catálogo, el aviso deja de interrumpir.
    const { condiciones, canal } = armar([
      filaDeAviso({ interrumpe_al_operador: false }),
    ]);

    await condiciones.aplicar([abrir()]);

    const mensaje = canal.recibidos[0];
    expect(mensaje.clase).toBe('nuevo');
    expect((mensaje as any).aviso.interrumpe).toBe(false);
    // Y sigue entrando a la campana: no interrumpir no es no existir.
    expect((mensaje as any).aviso.requiere_atencion).toBe(true);
  });

  it('🔴 una gravedad que el catálogo no conoce entra IGUAL, sin interrumpir', async () => {
    // El fallo seguro de esta tanda, y la dirección importa: desaparecer
    // rompería «no se pierde ninguna alerta»; gritar enseñaría a silenciar la
    // campana, que es la manera de perder las que sí importan.
    const { condiciones, canal } = armar([
      filaDeAviso({
        nivel_riesgo: 'inventado_por_alguien',
        color: null,
        interrumpe_al_operador: null,
        requiere_atencion_operador: null,
      }),
    ]);

    await condiciones.aplicar([abrir()]);

    const aviso = (canal.recibidos[0] as any).aviso;
    expect(aviso.clasificado).toBe(false);
    expect(aviso.interrumpe).toBe(false);
    expect(aviso.requiere_atencion).toBe(true);
  });

  it('🔴 el título sale del catálogo; si falta, se muestra el CÓDIGO', async () => {
    // Ver `SIN_REPORTE` en pantalla es feo. Ver una etiqueta inventada que
    // dice otra cosa es peligroso.
    const { condiciones, canal } = armar([filaDeAviso({ titulo: null })]);

    await condiciones.aplicar([abrir()]);

    expect((canal.recibidos[0] as any).aviso.titulo).toBe('SIN_REPORTE');
  });
});

describe('Despacho · el canal de la campana', () => {
  it('🔴 sin nadie mirando, entregar no es un error', () => {
    // La alerta ya está en la base. Que no haya navegadores conectados no es
    // una falla: es un martes a las 4 de la mañana.
    const canal = new CanalCampanaService();
    expect(() =>
      canal.entregar({ clase: 'nuevo', aviso: { tenant_id: TENANT } as any }),
    ).not.toThrow();
    expect(canal.clientesConFlujo()).toBe(0);
  });
});
