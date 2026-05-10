import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-hub-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key missing');
    }

    const payloadUserAvl = request.body?.User_avl;
    if (!payloadUserAvl) {
      throw new UnauthorizedException('User_avl is required in payload');
    }

    const cacheKey = `avl:apikey:${apiKey}`;
    let authData = await this.redis.get<{ avlUserId: string; tenantId: string; userAvlCode: string }>(cacheKey);

    if (!authData) {
      const avlUser = await this.prisma.avlUser.findUnique({
        where: { api_key: apiKey },
      });

      if (!avlUser) {
        throw new UnauthorizedException('API Key inválida o AVL User inactivo');
      }

      if (!avlUser.is_active) {
        throw new ForbiddenException('AVL User desactivado');
      }

      authData = {
        avlUserId: avlUser.id,
        tenantId: avlUser.tenant_id,
        userAvlCode: avlUser.user_avl_code,
      };

      await this.redis.set(cacheKey, authData, 3600); // 1 hour TTL
    }

    if (authData.userAvlCode !== payloadUserAvl) {
      throw new UnauthorizedException('User_avl no autorizado para esta API Key');
    }

    // Attach to request
    request.avlUser = authData;

    return true;
  }
}
