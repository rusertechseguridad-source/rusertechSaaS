import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { tenantStore } from '../common/cls/tenant.store';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  
  // Exponemos el cliente extendido para usar RLS
  public readonly extended: ReturnType<typeof this.getExtendedClient>;

  constructor() {
    super({
      log: ['error', 'warn'],
    });
    this.extended = this.getExtendedClient();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Connected');
    } catch (err) {
      this.logger.warn(`Prisma could not connect on startup (will retry on first request): ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Una sola línea aunque el canario dispare en cada consulta. */
  private canarioAvisado = false;

  private avisarConsultaNoBatcheable(): void {
    if (this.canarioAvisado) return;
    this.canarioAvisado = true;
    this.logger.warn(
      'query(args) dejó de ser un PrismaPromise: el set_config de tenant y la consulta ' +
        'podrían correr en conexiones distintas (el aislamiento por RLS dejaría de aplicar ' +
        'cuando se active FORCE). Revisar la extensión tras el upgrade de Prisma.',
    );
  }

  private getExtendedClient() {
    // Dentro de un handler de extensión, `this` NO es el cliente: Prisma
    // invoca estas funciones con otro receptor (el stack trace lo delata:
    // "Array.$allOperations"). La versión anterior hacía `this.$transaction`
    // y explotaba con TypeError en cuanto un usuario no-admin navegaba —
    // la referencia real se captura acá, en el closure.
    const clienteBase = this;

    return this.$extends({
      query: {
        $allModels: {
          // Tipos explícitos (equivalentes a los inferidos con el cliente
          // generado): sin `prisma generate` el $extends queda laxo y estos
          // parámetros serían `any` implícito — error de compilación acá.
          async $allOperations({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
            const context = tenantStore.getStore();

            if (context?.tenantId && context.role !== 'rusertech_admin') {
              // RLS: setear el tenant_id en el contexto de PostgreSQL, en la
              // MISMA conexión que la consulta. El batch $transaction
              // garantiza eso, y es el patrón oficial de Prisma para RLS con
              // extensiones. set_config(..., true) es local a la transacción.
              //
              // Se pasa por `query(args)` y no re-despachando `tx[model]`:
              // la versión vieja hacía `tx[model][operation]` con el nombre
              // de modelo en PascalCase ('Vehicle'), pero el cliente expone
              // delegados en camelCase ('vehicle') — habría fallado igual
              // apenas se corrigiera el `this`. `query` ya viene apuntando a
              // la operación correcta.
              //
              // Parametrizado: el tenantId viene del JWT, pero no hay motivo
              // para construir SQL por concatenación.
              // El cast es solo de tipos, no de comportamiento: el batch
              // $transaction exige PrismaPromise[], y la firma pública de
              // `query` declara Promise común. Pero en el runtime (verificado
              // en library.js de la versión instalada: el pipeline de
              // extensiones envuelve cada paso con _createPrismaPromise) lo
              // que `query(args)` devuelve SÍ es un PrismaPromise: expone
              // requestTransaction, el ejecutor del batch lo llama con
              // {kind:'batch', id, ...} y la consulta se inyecta en la MISMA
              // transacción/conexión que el set_config.
              // La forma con callback ($transaction(async tx => ...)) NO da
              // esa garantía: query(args) ahí no conoce a tx y correría por
              // otra conexión del pool — set_config local no le aplicaría.
              const consulta = query(args) as Prisma.PrismaPromise<any>;

              // Canario: la garantía anterior depende de un detalle interno de
              // Prisma. Si un upgrade lo cambiara, el batch ejecutaría la
              // consulta FUERA de la transacción sin ningún error visible —
              // esto convierte ese fallo silencioso en uno audible. (Crear el
              // PrismaPromise no dispara la consulta: es perezoso hasta que el
              // batch lo ejecuta.)
              if ((consulta as any)[Symbol.toStringTag] !== 'PrismaPromise') {
                clienteBase.avisarConsultaNoBatcheable();
              }

              const [, resultado] = await clienteBase.$transaction([
                clienteBase.$executeRaw`SELECT set_config('request.jwt.claim.tenant_id', ${context.tenantId}, true)`,
                consulta,
              ]);
              return resultado;
            }

            // Si es admin o no hay sesión, se ejecuta directo (o con bypass de RLS)
            return query(args);
          }
        }
      }
    });
  }
}
