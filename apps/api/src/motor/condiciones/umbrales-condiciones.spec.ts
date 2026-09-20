import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { UMBRALES_ESPEJADOS } from './umbrales-condiciones';
import { CONFIG_MOTOR_POR_DEFECTO } from '../tipos';

/**
 * EL DEFAULT DEL CÓDIGO CONTRA EL DEFAULT DE LA COLUMNA.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA SUITE EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * «Ya nos pasó con la tolerancia del recorrido: un default en el código y otro
 * en la base, desalineados.»
 *
 * Un comentario que dice «tiene que coincidir con la base» no impide que se
 * separen: sólo deja constancia de quién tenía razón, después. Lo único que lo
 * impide es una prueba que LEA LOS DOS LADOS y falle.
 *
 * Por eso el script de migración vive en el repositorio: para que esta prueba
 * tenga algo que leer. Si el script se editara sólo en el ZIP, o la constante
 * sólo en el código, la suite cae y dice cuál de los dos se movió.
 *
 * ⚠️ Y falla también por OMISIÓN. Si mañana se agrega un tercer umbral y nadie
 * lo suma a `UMBRALES_ESPEJADOS`, la comprobación de cobertura lo detecta: el
 * script tendría una columna con default que la lista no vigila.
 */

const SCRIPT = join(__dirname, '..', '..', '..', 'prisma', 'migrations', '31_etapa3b_condiciones.sql');

describe('Umbrales · el código y la base salen del mismo número', () => {
  it('el script de migración está en el repositorio', () => {
    // Sin el archivo, todas las comprobaciones de abajo pasarían sobre nada —
    // que es el modo de fallar que la Tanda 8 persigue.
    expect(existsSync(SCRIPT)).toBe(true);
  });

  const sql = existsSync(SCRIPT) ? readFileSync(SCRIPT, 'utf-8') : '';

  it.each(UMBRALES_ESPEJADOS)(
    '🔴 $columna: el DEFAULT de la columna es $valor, igual que en el código',
    ({ columna, valor }) => {
      const patron = new RegExp(
        `add column if not exists\\s+${columna}\\s+smallint\\s+not null\\s+default\\s+(\\d+)`,
        'i',
      );
      const encontrado = patron.exec(sql);

      expect(encontrado).not.toBeNull();
      expect(Number(encontrado?.[1])).toBe(valor);
    },
  );

  it('🔴 los umbrales espejados están en la configuración por defecto del motor', () => {
    // Si la constante existe y nadie la mete en `CONFIG_MOTOR_POR_DEFECTO`, un
    // tenant sin fila se quedaría con `undefined` y el evaluador compararía
    // contra NaN — que no falla, simplemente nunca abre nada.
    for (const { columna, valor } of UMBRALES_ESPEJADOS) {
      expect((CONFIG_MOTOR_POR_DEFECTO as unknown as Record<string, number>)[columna]).toBe(valor);
    }
  });

  it('🔴 toda columna con default del script está vigilada por la lista', () => {
    // La comprobación por OMISIÓN. Busca en el script cada `add column … default
    // <n>` sobre `tenant_engine_config` y exige que la lista la cubra.
    const enElScript = [...sql.matchAll(/add column if not exists\s+(\w+)\s+smallint\s+not null\s+default\s+\d+/gi)]
      .map((m) => m[1]);
    const vigiladas = new Set(UMBRALES_ESPEJADOS.map((u) => u.columna));

    expect(enElScript.length).toBeGreaterThan(0);
    expect(enElScript.filter((c) => !vigiladas.has(c))).toEqual([]);
  });

  it('el script respeta la regla de la serie: sin bloques DO', () => {
    // El editor de Supabase los rompe. Es la regla que salió de aplicar la 3A.
    //
    // ⚠️ Se mira el ARRANQUE DE LÍNEA, no el texto entero, y esta prueba se
    // corrigió a sí misma: la primera versión buscaba la secuencia en cualquier
    // parte y falló contra el propio encabezado del script, que dice «SIN
    // bloques DO». La prosa que explica la regla hacía fallar la comprobación
    // de la regla — séptima vez en esta serie, y la primera que la caza una
    // prueba en vez de una persona.
    const bloques = sql
      .split('\n')
      .map((l, i) => ({ l: l.trim().toLowerCase(), n: i + 1 }))
      .filter(({ l }) => l.startsWith('do $$'));

    expect(bloques.map((b) => b.n)).toEqual([]);
  });

  it('los CHECK del script tienen piso y techo, no sólo piso', () => {
    // Un umbral sin techo permite cargar 100000 y apagar la condición sin que
    // nadie note que está apagada.
    expect(sql).toMatch(/sin_reporte_minutos between \d+ and \d+/i);
    expect(sql).toMatch(/parada_prolongada_minutos between \d+ and \d+/i);
  });
});
