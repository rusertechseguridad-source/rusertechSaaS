/**
 * CARGA TEMPRANA DEL `.env`.
 *
 * Este módulo existe por una cuestión de ORDEN, no de configuración:
 * `ConfigModule.forRoot()` carga el `.env` recién cuando Nest construye el
 * AppModule — pero los decoradores `@Module` corren antes, en tiempo de
 * import. Y la decisión de registrar (o no) las colas de BullMQ se toma
 * justamente ahí (ver bull-opcional.ts): si `REDIS_URL` viviera solo en el
 * `.env`, en ese momento todavía no estaría en `process.env` y las colas no
 * se registrarían aunque Redis estuviera configurado.
 *
 * Por eso `main.ts` importa este módulo en su PRIMERA línea: el cuerpo de un
 * módulo importado se ejecuta completo antes de seguir con el siguiente
 * import, así que el `.env` queda cargado antes de que ningún decorador corra.
 *
 * `quiet` evita que dotenv agregue su propia línea a la consola (todo este
 * trabajo es, precisamente, contra el ruido). No pisa variables ya definidas:
 * si el entorno viene del shell o del sistema, esto es un no-op.
 */
import { config as cargarEnv } from 'dotenv';

cargarEnv({ quiet: true });
