import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  RAIZ_API, RAIZ_PAQUETE_API, RAIZ_WEB, leer, corto, fuentesApi, fuentesWeb, controladores, servicios,
  hayWeb, soloCodigo, dentroDeDecorador, literalesDeDecorador,
  registradoEnArray, rutasDeEscritura, rutaTieneAutorizacion,
  llamadasPrisma, metodosDe, metodoEnLinea, importacionesSinUsar,
} from './primitivas';
import {
  SIN_AUTORIZACION, CONSULTAS_SIN_TENANT, TOPE_RUTAS_SIN_DTO, ESCRITURAS_ROL_SIN_REGLA,
  TOPE_IMPORTS_SIN_USAR, archivosDe, exencionesMuertas,
} from './exenciones';
import { PERMISSION_KEYS } from '../constants/permissions';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LAS REGLAS DE CABLEADO — que los hallazgos no vuelvan
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Dos de los tres hallazgos más caros de la verificación integral no eran
 * errores de código sino de CABLEADO: `forwarding` declaraba `@Roles` sin
 * enchufar el guard, y `routes.findAll` importaba `tenantWhere` sin usarlo.
 * Los dos archivos se leen perfecto. Ni `tsc` ni una prueba los ven.
 *
 * Y el mismo patrón apareció cuatro veces más — una prueba de una función pura
 * no prueba que alguien la llame:
 *
 *   Tanda 2 · `tsc --noEmit` en el frontend devolvía 0 sin compilar nada
 *   Tanda 3 · la prueba de asignación masiva pasaba con la asignación abierta
 *   Tanda 3 · 12 pruebas certificaban la regla de roles y la ruta no la llamaba
 *   Tanda 5 · se quitó el INSERT del worker y las 27 pruebas siguieron verdes
 *
 * Estas reglas cruzan el repositorio contra sí mismo. Todas se apoyan en
 * `primitivas.ts`, que lee EL LUGAR que importa —dentro del decorador, dentro
 * del array, dentro del método— y no el archivo entero: leer el archivo es
 * exactamente por qué seis barridos anteriores pasaron su primera reversión.
 *
 * ── Velocidad ─────────────────────────────────────────────────────────────
 * Cada archivo se lee UNA vez y se cachea. Si el barrido tardara más que las
 * pruebas, se saltearía, y entonces no protege nada.
 */

// ── Caché de lectura ────────────────────────────────────────────────────────
const cache = new Map<string, string>();
const texto = (f: string): string => {
  let t = cache.get(f);
  if (t === undefined) { t = leer(f); cache.set(f, t); }
  return t;
};

const FUENTES_API = fuentesApi();
const CONTROLADORES = controladores();
const SERVICIOS = servicios();
const RUTAS_CONTROLADOR = new Set(CONTROLADORES.map((f) => corto(f)));
/** Todas las fuentes del backend, por nombre corto. Sirve para exenciones muertas. */
const ARCHIVOS_API = new Set(FUENTES_API.map((f) => corto(f)));

/**
 * Delegates de Prisma cuyo modelo tiene `tenant_id`.
 *
 * Se derivan de `schema.prisma` EN TIEMPO DE EJECUCIÓN y no de una lista
 * escrita a mano: una lista se desincroniza en silencio, y este proyecto ya
 * tuvo tres veces el problema de una lista inventada que omitía columnas.
 */
const DELEGATES_CON_TENANT: Set<string> = (() => {
  const esquema = readFileSync(join(RAIZ_PAQUETE_API, 'prisma', 'schema.prisma'), 'utf-8');
  const salida = new Set<string>();
  for (const m of esquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    if (/^\s*tenant_id\s/m.test(m[2])) salida.add(m[1][0].toLowerCase() + m[1].slice(1));
  }
  return salida;
})();

/** Operaciones que devuelven o tocan MÚLTIPLES filas. */
const OPERACIONES_MULTIPLES = ['findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'];

/**
 * Señales de que el método SÍ acota por tenant.
 *
 * Incluye las formas indirectas que usa este repositorio, porque una regla que
 * sólo mire el paréntesis de la consulta produce falsos positivos — y un
 * barrido que grita en falso se apaga, que es la forma más rápida de que deje
 * de proteger. Medido: sin esto marcaba cuatro servicios que sí filtran.
 */
const ACOTA_POR_TENANT = /tenantWhere\s*\(|tenant_id\s*[:=]|assertTenantOwnership|DelTenant\s*\(|idsPermitidos/;

/** ¿El CONTROLADOR entero declara autorización, antes de `export class`? */
function claseAutoriza(t: string): boolean {
  const cabecera = soloCodigo(t).split(/export\s+class\b/)[0] ?? '';
  return /@Roles\(/.test(cabecera) || /@RequirePermissions\(/.test(cabecera);
}

describe('Cableado · las reglas que impiden que los hallazgos vuelvan', () => {
  it('el barrido encuentra el código que dice mirar', () => {
    // Sin esto, un glob roto dejaría TODAS las reglas en verde sobre cero
    // archivos: el peor resultado posible, porque parece que protegen.
    expect(CONTROLADORES.length).toBeGreaterThan(20);
    expect(SERVICIOS.length).toBeGreaterThan(20);
    expect(FUENTES_API.length).toBeGreaterThan(100);
    expect(DELEGATES_CON_TENANT.size).toBeGreaterThan(25);
  });

  // ════════════════════════════════════════════════════════════════════════
  // AUTORIZACIÓN
  // ════════════════════════════════════════════════════════════════════════

  describe('Autorización', () => {
    it('R1 · ningún @Roles sin RolesGuard en el mismo @UseGuards', () => {
      // El hallazgo original: `forwarding` declaraba los roles y no enchufaba
      // el guard, así que el decorador era decoración.
      const inertes = CONTROLADORES.filter((f) => {
        const t = texto(f);
        return /@Roles\(/.test(soloCodigo(t)) && !dentroDeDecorador(t, 'UseGuards', 'RolesGuard');
      }).map((f) => corto(f));
      expect(inertes).toEqual([]);
    });

    it('R2 · ningún @RequirePermissions sin PermissionsGuard', () => {
      const inertes = CONTROLADORES.filter((f) => {
        const t = texto(f);
        return /@RequirePermissions\(/.test(soloCodigo(t))
            && !dentroDeDecorador(t, 'UseGuards', 'PermissionsGuard');
      }).map((f) => corto(f));
      expect(inertes).toEqual([]);
    });

    it('R3 · ninguna ruta de ESCRITURA sin autorización, ruta por ruta', () => {
      // ⚠️ Ruta por ruta, no archivo por archivo. Un controlador con diez
      // rutas protegidas y una sin protección se lee como protegido si se
      // busca el decorador en el archivo entero.
      expect(exencionesMuertas(SIN_AUTORIZACION, RUTAS_CONTROLADOR)).toEqual([]);
      const exentos = archivosDe(SIN_AUTORIZACION);

      const desprotegidas: string[] = [];
      for (const f of CONTROLADORES) {
        const nombre = corto(f);
        if (exentos.has(nombre)) continue;
        const t = texto(f);
        if (claseAutoriza(t)) continue;
        for (const r of rutasDeEscritura(t)) {
          if (!rutaTieneAutorizacion(r)) desprotegidas.push(`${nombre}:${r.linea} @${r.metodo}('${r.camino}')`);
        }
      }
      expect(desprotegidas).toEqual([]);
    });

    it('R4 · ningún permiso fuera del catálogo', () => {
      // Un permiso inventado es peor que ninguno: parece protegido y no lo
      // está, porque `PermissionsGuard` compara strings exactos.
      const inventados: string[] = [];
      for (const f of CONTROLADORES) {
        for (const p of literalesDeDecorador(texto(f), 'RequirePermissions')) {
          if (!(PERMISSION_KEYS as readonly string[]).includes(p)) {
            inventados.push(`${corto(f)} → ${p}`);
          }
        }
      }
      expect(inventados).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // AISLAMIENTO ENTRE CLIENTES — el principio que rige el producto
  // ════════════════════════════════════════════════════════════════════════

  describe('Aislamiento entre clientes', () => {
    it('R5 · ninguna consulta múltiple sobre una tabla con tenant_id sin acotar', () => {
      const exentas = new Set(CONSULTAS_SIN_TENANT.map((e) => `${e.archivo}|${e.delegate}`));
      const archivosExentos = new Set(CONSULTAS_SIN_TENANT.map((e) => e.archivo));
      const archivosReales = new Set(FUENTES_API.map((f) => corto(f)));
      expect([...archivosExentos].filter((a) => !archivosReales.has(a))).toEqual([]);

      const sueltas: string[] = [];
      for (const f of FUENTES_API) {
        const nombre = corto(f);
        const t = texto(f);
        const metodos = metodosDe(t);
        for (const c of llamadasPrisma(t)) {
          if (!DELEGATES_CON_TENANT.has(c.delegate)) continue;
          if (!OPERACIONES_MULTIPLES.includes(c.operacion)) continue;
          if (exentas.has(`${nombre}|${c.delegate}`)) continue;
          const ambito = metodoEnLinea(metodos, c.linea)?.cuerpo ?? t;
          if (ACOTA_POR_TENANT.test(ambito)) continue;
          sueltas.push(`${nombre}:${c.linea} ${c.delegate}.${c.operacion}`);
        }
      }
      expect(sueltas).toEqual([]);
    });

    it('R6 · ningún `connect` por FK sin comprobar la pertenencia', () => {
      // Conectar por id un recurso de OTRO cliente es una fuga que no se ve:
      // la fila se crea bien, apuntando a donde no debe.
      const sinComprobar: string[] = [];
      for (const f of FUENTES_API) {
        const t = texto(f);
        if (!/\bconnect\s*:/.test(soloCodigo(t))) continue;
        for (const m of metodosDe(t)) {
          if (!/\bconnect\s*:/.test(m.cuerpo)) continue;
          if (ACOTA_POR_TENANT.test(m.cuerpo)) continue;
          sinComprobar.push(`${corto(f)}:${m.linea} ${m.nombre}`);
        }
      }
      expect(sinComprobar).toEqual([]);
    });

    it('R7 · el cuerpo sin DTO sólo puede achicarse (cliquet)', () => {
      // ⚠️ El pipe sólo valida si el parámetro está tipado con una CLASE:
      // `@Body() data: any` da metatipo `Object` y no valida nada.
      //
      // Una lista blanca de archivos sería inútil —una ruta nueva sin DTO
      // entraría por un archivo ya exento— así que se congela el NÚMERO y se
      // comprueba `<=`: sube y falla, baja y hay que bajar el tope.
      expect([...Object.keys(TOPE_RUTAS_SIN_DTO)].filter((a) => !RUTAS_CONTROLADOR.has(a))).toEqual([]);

      const excesos: string[] = [];
      const mejoras: string[] = [];
      for (const f of CONTROLADORES) {
        const nombre = corto(f);
        const sinDto = rutasDeEscritura(texto(f)).filter((r) =>
          /@Body\([^)]*\)\s*\w+\s*:\s*(any|object|Record|unknown)\b/i.test(r.firma),
        ).length;
        const tope = TOPE_RUTAS_SIN_DTO[nombre] ?? 0;
        if (sinDto > tope) excesos.push(`${nombre}: ${sinDto} sin DTO, el tope es ${tope}`);
        if (sinDto < tope) mejoras.push(`${nombre}: bajó a ${sinDto}, bajá el tope de ${tope} en exenciones.ts`);
      }
      expect(excesos).toEqual([]);
      // Una mejora también avisa: si no, el tope viejo dejaría margen para
      // volver a empeorar sin que el cliquet lo note.
      expect(mejoras).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // QUE LAS REGLAS SE USEN — la clase que faltó tres veces
  // ════════════════════════════════════════════════════════════════════════

  describe('Que las reglas se usen', () => {
    it('R8 · todo servicio que ESCRIBE role_code llama a exigirRolAsignable', () => {
      // El hallazgo de la Tanda 3: 12 pruebas certificaban la regla y la ruta
      // real no la llamaba. Eran TRES caminos de escritura y la regla cubría
      // uno. Gustavo lo verificó en producción asignando "Admin Master".
      //
      // ⚠️ Sólo ESCRITURAS: `role_code: { in: [...] }` en un `where` es un
      // filtro, y marcarlo daría un falso positivo en `vehicles.service.ts`.
      // Lo detectó la medición.
      // ⚠️ Y por MÉTODO, no por archivo. La primera versión preguntaba si el
      // ARCHIVO nombraba `exigirRolAsignable`, y su reversión NO falló: saqué
      // la llamada de `inviteUser` y el barrido siguió en verde porque el
      // import y la llamada de `updateUser` seguían ahí. Es el mismo error que
      // la Tanda 7 cometió con el import de `HealthModule`: preguntar si el
      // archivo MENCIONA algo en vez de si el sitio que importa lo USA.
      // ⚠️ Qué cuenta como ESCRIBIR el rol. Las trece apariciones de
      // `role_code` en los servicios se miraron una por una, y son de cuatro
      // formas distintas — la regla se escribió contra ESO, no contra una idea:
      //
      //   ESCRIBEN   `role_code: 'account_owner'`   valor constante
      //              `role_code: data.role_code`    valor de quien llama
      //              `updateData.role_code = …`     asignación
      //   NO ESCRIBEN
      //              `role_code: true`              es un `select`
      //              `role_code: { in: [...] }`     es un `where` (vehicles)
      //              `role: user.role_code`         lee una propiedad
      //              `rolSolicitado: data.role_code` es el argumento de la regla
      //
      // Sin esa precisión el barrido marcaba `auth.login` —que sólo copia el
      // rol al JWT— y `vehicles.toggleBlock`. Un barrido que grita en falso se
      // apaga, y entonces no protege nada.
      //
      // ⚠️ Y el `\s*` va DENTRO del lookahead, no antes. La primera versión
      // decía `role_code\s*:\s*(?!true\b|\{)` y no excluía NADA: el `\s*`
      // retrocede a cero caracteres, el lookahead mira " true" —que no empieza
      // con "true"— y da por bueno el match. Excluía en la intención y no en
      // la ejecución, y sólo se vio porque la regla marcó `getUsers`, que no
      // escribe nada. Una condición que parece puesta y no lo está es peor que
      // no ponerla: nadie la vuelve a mirar.
      const ESCRIBE_ROL = /(?<![.\w])role_code\s*:(?!\s*(?:true\b|\{))|\.role_code\s*=(?!=)/;

      const exentos = new Set(ESCRITURAS_ROL_SIN_REGLA.map((e) => `${e.archivo}|${e.metodo}`));
      const sinRegla: string[] = [];
      const vistos = new Set<string>();
      for (const f of SERVICIOS) {
        const nombre = corto(f);
        for (const m of metodosDe(texto(f))) {
          if (!ESCRIBE_ROL.test(m.cuerpo)) continue;
          vistos.add(`${nombre}|${m.nombre}`);
          if (exentos.has(`${nombre}|${m.nombre}`)) continue;
          if (/exigirRolAsignable/.test(m.cuerpo)) continue;
          sinRegla.push(`${nombre}:${m.linea} ${m.nombre}`);
        }
      }
      expect(sinRegla).toEqual([]);
      // Y si un método exento deja de escribir el rol —o se renombra— la
      // exención sobra y hay que borrarla: se limpia sola.
      expect([...exentos].filter((e) => !vistos.has(e))).toEqual([]);
    });

    it('R9 · los servicios que filtran por entidad reciben AccesoEntidadesService', () => {
      // La restricción no se puede aplicar si el servicio nunca ve quién
      // pregunta. Ése era el diagnóstico literal: "la firma del servicio ni
      // siquiera recibe al usuario".
      const esperados = [
        'vehicles/vehicles.service.ts',
        'trips/trips.service.ts',
        'locations/locations.service.ts',
        'alerts/alerts.service.ts',
        'sensors/sensors.service.ts',
      ];
      const inexistentes = esperados.filter((r) => !existsSync(join(RAIZ_API, r)));
      expect(inexistentes).toEqual([]);
      // ⚠️ Se busca la INYECCIÓN, no el import. La primera versión hacía
      // `.includes('AccesoEntidadesService')` sobre el archivo entero y su
      // reversión no falló: quitando el parámetro del constructor —o sea,
      // dejando al servicio otra vez sin saber quién pregunta— el import
      // seguía ahí y el barrido daba verde. Un import sin uso es exactamente
      // el hallazgo que esta tanda persigue: `routes.findAll` importaba
      // `tenantWhere` y no lo llamaba.
      const inyeccion = /(?:private|public|protected|readonly)[^;()]*:\s*AccesoEntidadesService\b/;
      const sinAcceso = esperados.filter((r) => !inyeccion.test(soloCodigo(texto(join(RAIZ_API, r)))));
      expect(sinAcceso).toEqual([]);
    });

    it('R10 · el worker del motor LLAMA a la persistencia de eventos', () => {
      // Se quitó la línea `await this.eventos.persistir(...)` y las 27 pruebas
      // siguieron en verde: la suite del servicio prueba el SERVICIO, no que
      // alguien lo use. `motor.worker.cableado.spec.ts` lo prueba ejecutando;
      // esto es la red de seguridad estática, y mira DENTRO de un método.
      const worker = texto(join(RAIZ_API, 'motor', 'motor.worker.ts'));
      const llamadas = metodosDe(worker).filter((m) => /this\.eventos\.persistir\s*\(/.test(m.cuerpo));
      expect(llamadas.length).toBeGreaterThan(0);
    });

    it('R16 · las importaciones sin usar sólo pueden achicarse (cliquet)', () => {
      // ⚠️ La regla que le pone nombre a la tanda. `routes.findAll` importaba
      // `tenantWhere` y no lo llamaba: el import prometía un filtro por cliente
      // que la consulta no tenía. Ni `tsc` ni una prueba lo ven, y el archivo
      // se lee bien. Un import sin usar es una intención declarada y no
      // cumplida, igual que un `@Roles` sin guard.
      //
      // La primitiva se contrastó contra `tsc --noUnusedLocals`, que es la
      // autoridad: los dos dan los mismos siete archivos. La primera versión
      // daba OCHO —se comía la línea siguiente en un import de efecto— y sólo
      // se supo por comparar contra el compilador en vez de contra mi criterio.
      //
      // Cliquet y no lista blanca: con una lista, un import muerto NUEVO
      // entraría por un archivo ya exento, que es justo lo que hay que impedir.
      expect(Object.keys(TOPE_IMPORTS_SIN_USAR).filter((a) => !ARCHIVOS_API.has(a))).toEqual([]);

      const excesos: string[] = [];
      const mejoras: string[] = [];
      for (const f of FUENTES_API) {
        const nombre = corto(f);
        const cuantos = importacionesSinUsar(texto(f)).length;
        const tope = TOPE_IMPORTS_SIN_USAR[nombre] ?? 0;
        if (cuantos > tope) excesos.push(`${nombre}: ${cuantos} sin usar, el tope es ${tope}`);
        if (cuantos < tope) mejoras.push(`${nombre}: bajó a ${cuantos}, bajá el tope de ${tope} en exenciones.ts`);
      }
      expect(excesos).toEqual([]);
      expect(mejoras).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN
  // ════════════════════════════════════════════════════════════════════════

  describe('Configuración', () => {
    it('R11 · el verificador tiene las CUATRO comprobaciones', () => {
      // ⚠️ La cuarta es la que faltaba y la que más costó: `tsc --noEmit` en
      // `apps/web` compila CERO archivos, porque su tsconfig es un proyecto
      // solución (`files: []` más `references`). Devolvía 0 sin mirar nada y
      // vino aprobando el frontend durante dos tandas.
      const pkg = JSON.parse(texto(join(RAIZ_PAQUETE_API, 'package.json')));
      const verificar: string = pkg.scripts?.verificar ?? '';
      expect(verificar).toContain('tsc --noEmit');
      expect(verificar).toContain('tsc -p tsconfig.build.json --noEmit');
      expect(verificar).toContain('jest');
      expect(verificar).toContain('cd ../web && tsc -b --force');
      // Y que NO se haya vuelto al que no compilaba nada.
      expect(verificar).not.toMatch(/cd \.\.\/web && tsc --noEmit/);
    });

    it('R12 · los DOS tsconfig excluyen prisma.config.ts', () => {
      // `exclude` NO se hereda: cuando un hijo lo declara, REEMPLAZA al del
      // padre. Al omitirlo en `tsconfig.build.json` la API no arrancaba
      // (TS1470) mientras `tsc --noEmit` daba 0.
      //
      // ⚠️ Y se mira DENTRO del array `exclude`. La primera versión hacía
      // `toContain('prisma.config.ts')` sobre el archivo entero, y su
      // reversión no falló: saqué el nombre del `exclude` y el barrido siguió
      // verde porque el COMENTARIO que explica por qué está excluido también
      // lo nombra. La explicación de la corrección certificaba la corrección.
      for (const archivo of ['tsconfig.json', 'tsconfig.build.json']) {
        const t = texto(join(RAIZ_PAQUETE_API, archivo));
        expect(registradoEnArray(t, 'exclude', 'prisma.config.ts')).toBe(true);
      }
      // Y el build sigue acotado a `src`, que es lo que pone `main` en su sitio.
      const build = texto(join(RAIZ_PAQUETE_API, 'tsconfig.build.json'));
      expect(build).toMatch(/"include":\s*\[\s*"src/);
      // Esta carpeta es infraestructura de barrido: la importan los `.spec.ts`
      // y nadie más. Si entrara al build, `dist/` se llevaría un `require('glob')`
      // de un paquete que no está declarado en el `package.json`.
      expect(registradoEnArray(build, 'exclude', 'src/common/cableado')).toBe(true);
    });

    it('R13 · ningún @ts-ignore ni @ts-expect-error en el backend', () => {
      // "No los silencies con `any` ni con `@ts-ignore`" — la regla de la
      // Tanda 2, fijada. Se mira el CÓDIGO, no los comentarios que la explican.
      //
      // ⚠️ Ésta se escribió mal de raíz y su reversión lo probó: buscaba en
      // `sinComentarios(...)`, y `@ts-ignore` SÓLO existe como comentario. La
      // regla no podía fallar nunca. Puse un `// @ts-ignore` de verdad en un
      // servicio y el barrido dio verde: era una regla decorativa, del mismo
      // género que el `@Roles` sin guard que esta tanda vino a cazar.
      //
      // Se busca la FORMA del directivo —el comentario que empieza con él—
      // sobre el texto crudo. Así una prosa que lo nombre («no lo silencies
      // con @ts-ignore») no cuenta, y el directivo real sí.
      const DIRECTIVO = /(?:\/\/|\/\*)\s*@ts-(?:ignore|expect-error)\b/;
      const culpables = FUENTES_API.filter((f) => DIRECTIVO.test(texto(f))).map((f) => corto(f));
      expect(culpables).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FRONTEND
  // ════════════════════════════════════════════════════════════════════════

  (hayWeb() ? describe : describe.skip)('Frontend', () => {
    it('R14 · ninguna dirección del backend incrustada', () => {
      // Eran 149 en 49 archivos: subida a un servidor, la aplicación le pedía
      // los datos a la máquina de quien abría el navegador.
      //
      // ⚠️ `soloCodigo` y NO `sinComentarios`. Las dos quitan comentarios, pero
      // `sinComentarios` además VACÍA los literales de texto… y una dirección
      // incrustada vive justamente dentro de un literal. Con la primitiva
      // equivocada, `'http://localhost:3000/api/v1'` quedaba en `''` antes de
      // que la regla mirara: R14 y R15 no podían fallar. La reversión lo
      // mostró; leerlas no. La cautela de la Tanda 7 —no matchear la propia
      // prosa— aplicada donde el objetivo ES una cadena, apagaba la regla.
      const culpables = fuentesWeb()
        .filter((f) => /localhost:\d{4}/.test(soloCodigo(texto(f))))
        .map((f) => corto(f, RAIZ_WEB));
      expect(culpables).toEqual([]);
    });

    it('R15 · nadie llama al backend con una ruta relativa', () => {
      // Una ruta relativa resolvería contra el servidor de Vite y daría 404:
      // es el error que la variable de entorno vino a evitar, por el otro lado.
      const culpables = fuentesWeb()
        // Mismo motivo que en R14: la ruta relativa es un literal.
        .filter((f) => /fetch\(\s*[`'"]\/api\/v1/.test(soloCodigo(texto(f))))
        .map((f) => corto(f, RAIZ_WEB));
      expect(culpables).toEqual([]);
    });
  });
});
