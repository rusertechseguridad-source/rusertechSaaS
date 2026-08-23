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

  private getExtendedClient() {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = tenantStore.getStore();
            
            if (context?.tenantId && context.role !== 'rusertech_admin') {
              // RLS: Establecer el tenant_id en el contexto de PostgreSQL
              // Utilizamos una transacción interactiva para asegurar que se setee en la misma conexión
              return this.$transaction(async (tx: any) => {
                // Parametrizado: el tenantId viene del JWT, pero no hay motivo
                // para construir SQL por concatenación.
                await tx.$executeRaw`SELECT set_config('request.jwt.claim.tenant_id', ${context.tenantId}, true)`;
                // Ignoramos el error en types temporalmente o usamos "query" que viene del callback
                return (tx as any)[model][operation](args);
              });
            }
            
            // Si es admin o no hay sesión, se ejecuta directo (o con bypass de RLS)
            return query(args);
          }
        }
      }
    });
  }
}
