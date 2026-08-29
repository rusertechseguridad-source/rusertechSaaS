import { Reflector } from '@nestjs/core';
import { RoutesService } from '../../routes/routes.service';
import { ForwardingController } from '../../forwarding/forwarding.controller';
import { AppController } from '../../app.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

/**
 * TANDA 1 — pruebas de CABLEADO, no de lógica.
 *
 * Dos de los tres hallazgos más caros de la verificación integral no eran
 * errores de código sino de conexión: `forwarding` declaraba `@Roles` sin
 * enchufar el guard que lo hace efectivo, y `routes.findAll` importaba
 * `tenantWhere` y no lo usaba. Los dos archivos se leían perfecto y ningún
 * `tsc` ni test los veía.
 *
 * Estas pruebas miran los METADATOS que Nest realmente evalúa en tiempo de
 * ejecución, que es donde vivía el problema. La versión general de esta idea
 * es la Tanda 8; ésta cubre sólo lo que se tocó acá.
 */
describe('Tanda 1 · el cableado quedó enchufado', () => {
  const reflector = new Reflector();
  const guardsDe = (target: any): any[] =>
    reflector.get<any[]>('__guards__', target) ?? [];

  describe('routes.findAll · el filtro por tenant', () => {
    const prismaMock: any = { extended: { route: { findMany: jest.fn() } } };
    const service = new RoutesService(prismaMock);

    beforeEach(() => jest.clearAllMocks());

    it('filtra por el tenant del usuario', async () => {
      await service.findAll('tenant-A');
      const args = prismaMock.extended.route.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenant_id: 'tenant-A' });
    });

    it('NUNCA consulta sin `where` (que era la fuga)', async () => {
      await service.findAll('tenant-A');
      const args = prismaMock.extended.route.findMany.mock.calls[0][0];
      expect(args.where).toBeDefined();
      expect(args.where.tenant_id).toBeTruthy();
    });

    it('falla ruidosamente si el controller no propaga el tenant', async () => {
      // `where: { tenant_id: undefined }` NO filtra en Prisma: descarta la
      // clave y devuelve todo. `tenantWhere` convierte ese olvido en un 500.
      await expect(service.findAll(undefined as any)).rejects.toThrow(/tenantId/);
      expect(prismaMock.extended.route.findMany).not.toHaveBeenCalled();
    });
  });

  describe('forwarding · el guard que hace efectivo al decorador', () => {
    it('declara RolesGuard junto a JwtAuthGuard', () => {
      const guards = guardsDe(ForwardingController);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('sigue declarando los roles que ahora sí se evalúan', () => {
      expect(reflector.get<string[]>('roles', ForwardingController)).toEqual(
        expect.arrayContaining(['account_owner', 'manager', 'rusertech_admin']),
      );
    });
  });

  describe('upload · deja de ser el único endpoint anónimo', () => {
    it('exige token', () => {
      expect(guardsDe(AppController.prototype.uploadFile)).toContain(JwtAuthGuard);
    });

    it('el handler público de arriba sigue siendo público (no se pasó de rosca)', () => {
      // `getHello` no llevaba guard y no era parte del encargo: si esta prueba
      // falla, alguien amplió el alcance de la tanda sin decirlo.
      expect(guardsDe(AppController.prototype.getHello)).toHaveLength(0);
    });
  });
});
