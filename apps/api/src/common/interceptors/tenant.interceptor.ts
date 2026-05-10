import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStore } from '../cls/tenant.store';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Si la petición ya pasó por el JwtAuthGuard, request.user estará populado.
    if (user && user.tenantId) {
      return tenantStore.run({ tenantId: user.tenantId, userId: user.id, role: user.role }, () => {
        return next.handle();
      });
    }

    return next.handle();
  }
}
