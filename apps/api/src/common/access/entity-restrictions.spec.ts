import {
  filtroDeAcceso,
  interpretarRestricciones,
  resumirValor,
} from './entity-restrictions';

/**
 * La invariante que prueban estos tests es la que hoy está rota en producción:
 *
 *   una restricción que el código no entiende NO es lo mismo que la ausencia
 *   de restricción.
 *
 * La versión anterior (`er && Array.isArray(er.vehicles) && er.vehicles.length`)
 * colapsaba los dos casos en "seguí sin filtro". Cada bloque de abajo se
 * corresponde con una fila de la tabla de comportamiento del análisis C3.
 */
describe('interpretarRestricciones', () => {
  const VEHICULO_A = '11111111-1111-4111-8111-111111111111';
  const VEHICULO_B = '22222222-2222-4222-8222-222222222222';

  describe('SIN RESTRICCIÓN — el usuario legítimamente ve todo', () => {
    it('acepta el valor ausente (columna nunca escrita)', () => {
      expect(interpretarRestricciones(undefined, 'vehicles')).toEqual({
        decision: 'sin_restriccion',
      });
    });

    it('acepta JSON null', () => {
      // Prisma devuelve `null` para un `'null'::jsonb` almacenado.
      expect(interpretarRestricciones(null, 'vehicles')).toEqual({
        decision: 'sin_restriccion',
      });
    });

    it('acepta el objeto vacío, que es el default de la columna', () => {
      expect(interpretarRestricciones({}, 'vehicles')).toEqual({
        decision: 'sin_restriccion',
      });
    });

    it('acepta la clave con arreglo vacío — lo que escribe hoy la UI', () => {
      // Este es el caso que impide endurecer `[]` a "no ve nada": la pantalla
      // de Configuración manda {vehicles: [], locations: []} para todo viewer
      // al que no se le tildó nada.
      expect(interpretarRestricciones({ vehicles: [] }, 'vehicles')).toEqual({
        decision: 'sin_restriccion',
      });
    });

    it('acepta la clave explícitamente en null', () => {
      expect(interpretarRestricciones({ vehicles: null }, 'vehicles')).toEqual({
        decision: 'sin_restriccion',
      });
    });

    it('trata las dimensiones por separado: restringir vehículos no restringe ubicaciones', () => {
      expect(interpretarRestricciones({ vehicles: [VEHICULO_A] }, 'locations')).toEqual({
        decision: 'sin_restriccion',
      });
    });
  });

  describe('LISTA — hay una restricción legible', () => {
    it('devuelve los ids de un arreglo de UUIDs', () => {
      expect(interpretarRestricciones({ vehicles: [VEHICULO_A, VEHICULO_B] }, 'vehicles')).toEqual({
        decision: 'lista',
        ids: [VEHICULO_A, VEHICULO_B],
      });
    });

    it('lee la dimensión de ubicaciones con la misma regla', () => {
      expect(interpretarRestricciones({ locations: [VEHICULO_A] }, 'locations')).toEqual({
        decision: 'lista',
        ids: [VEHICULO_A],
      });
    });

    it('acepta UUIDs en mayúsculas', () => {
      const enMayusculas = VEHICULO_A.toUpperCase();
      expect(interpretarRestricciones({ vehicles: [enMayusculas] }, 'vehicles')).toEqual({
        decision: 'lista',
        ids: [enMayusculas],
      });
    });

    it('deduplica repetidos', () => {
      expect(
        interpretarRestricciones({ vehicles: [VEHICULO_A, VEHICULO_A, VEHICULO_B] }, 'vehicles'),
      ).toEqual({ decision: 'lista', ids: [VEHICULO_A, VEHICULO_B] });
    });

    it('ignora claves extra del objeto', () => {
      expect(
        interpretarRestricciones(
          { vehicles: [VEHICULO_A], carriers: 'basura', otra: 1 },
          'vehicles',
        ),
      ).toEqual({ decision: 'lista', ids: [VEHICULO_A] });
    });
  });

  describe('ILEGIBLE — hay algo escrito y no se entiende: se deniega', () => {
    // ⚠️ TODOS estos casos hoy pasan SIN filtro y el usuario ve todo el tenant.
    const casosQueHoyFallanEnAbierto: Array<[string, unknown]> = [
      ['la clave es un string', { vehicles: 'abc' }],
      ['la clave es un objeto', { vehicles: {} }],
      ['la clave es un objeto con datos', { vehicles: { [VEHICULO_A]: true } }],
      ['la clave es un número', { vehicles: 3 }],
      ['la clave es un booleano', { vehicles: true }],
      ['la raíz es un string', 'vehicles'],
      ['la raíz es un número', 42],
      ['la raíz es un booleano', true],
      ['la raíz es un arreglo de ids', [VEHICULO_A]],
      ['la raíz es un arreglo vacío', []],
      ['el arreglo mezcla UUID con número', { vehicles: [VEHICULO_A, 123] }],
      ['el arreglo mezcla UUID con null', { vehicles: [VEHICULO_A, null] }],
      ['el arreglo trae objetos', { vehicles: [{ id: VEHICULO_A }] }],
      ['el arreglo trae strings que no son UUID', { vehicles: ['todos'] }],
      ['el arreglo trae un string vacío', { vehicles: [''] }],
      ['el UUID viene con espacios', { vehicles: [` ${VEHICULO_A} `] }],
      ['el arreglo trae arreglos anidados', { vehicles: [[VEHICULO_A]] }],
    ];

    it.each(casosQueHoyFallanEnAbierto)('deniega cuando %s', (_caso, valor) => {
      const resultado = interpretarRestricciones(valor, 'vehicles');
      expect(resultado.decision).toBe('ilegible');
    });

    it('explica el motivo en un texto accionable para el log', () => {
      const resultado = interpretarRestricciones({ vehicles: 'abc' }, 'vehicles');
      expect(resultado).toEqual({
        decision: 'ilegible',
        motivo: '"vehicles" es string, se esperaba un arreglo',
      });
    });

    it('un solo elemento inválido invalida la lista entera', () => {
      // No se puede saber si los UUIDs que sí están son "los permitidos" o
      // apenas lo que sobrevivió a lo que corrompió el valor.
      const resultado = interpretarRestricciones(
        { vehicles: [VEHICULO_A, VEHICULO_B, 'x'] },
        'vehicles',
      );
      expect(resultado).toEqual({
        decision: 'ilegible',
        motivo: '"vehicles" tiene 1 de 3 elemento(s) que no son UUID',
      });
    });
  });

  it('nunca devuelve una decisión fuera de las tres conocidas', () => {
    // Barrido: ningún valor puede producir un estado que el llamador no sepa
    // interpretar — que es como se llega a una consulta sin filtro.
    const valores: unknown[] = [
      undefined, null, {}, [], '', 0, false, NaN, 'x', { vehicles: undefined },
      { vehicles: [VEHICULO_A] }, { vehicles: [1] }, new Date(),
    ];
    for (const valor of valores) {
      expect(['sin_restriccion', 'lista', 'ilegible']).toContain(
        interpretarRestricciones(valor, 'vehicles').decision,
      );
    }
  });
});

describe('filtroDeAcceso', () => {
  const ID = '33333333-3333-4333-8333-333333333333';

  it('no agrega condiciones cuando no hay restricción', () => {
    expect(filtroDeAcceso({ decision: 'sin_restriccion' }, 'id')).toEqual({});
  });

  it('filtra por el campo pedido cuando hay lista', () => {
    expect(filtroDeAcceso({ decision: 'lista', ids: [ID] }, 'vehicle_id')).toEqual({
      vehicle_id: { in: [ID] },
    });
  });

  it('cierra con una lista vacía cuando el valor es ilegible', () => {
    // `{ in: [] }` no matchea ninguna fila: falla CERRADO aunque el servicio
    // dejara de lanzar 403.
    expect(filtroDeAcceso({ decision: 'ilegible', motivo: 'x' }, 'id')).toEqual({
      id: { in: [] },
    });
  });

  it('devuelve una copia: mutar el filtro no toca la restricción original', () => {
    const restriccion = { decision: 'lista' as const, ids: [ID] };
    const filtro = filtroDeAcceso(restriccion, 'id') as { id: { in: string[] } };
    filtro.id.in.push('otro');
    expect(restriccion.ids).toEqual([ID]);
  });
});

describe('resumirValor', () => {
  it('serializa el valor tal cual cuando es corto', () => {
    expect(resumirValor({ vehicles: 'abc' })).toBe('{"vehicles":"abc"}');
  });

  it('recorta lo que no entra y avisa el largo real', () => {
    const largo = { vehicles: 'x'.repeat(500) };
    const resumen = resumirValor(largo, 50);
    expect(resumen.length).toBeLessThan(80);
    expect(resumen).toContain('chars)');
  });

  it('no se cae con un valor no serializable', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => resumirValor(circular)).not.toThrow();
  });
});
