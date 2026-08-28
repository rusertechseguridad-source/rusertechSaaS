import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Era la plantilla "should be defined" sin las dependencias del módulo real:
 * fallaba en la inyección desde siempre. Ahora prueba la delegación del
 * controller con el servicio mockeado.
 */
describe('AdminController', () => {
  let controller: AdminController;

  const adminServiceMock = {
    getTenants: jest.fn().mockResolvedValue([{ id: 't1' }]),
    getTenantStats: jest.fn().mockResolvedValue({ vehicles: 1, activeTrips: 0, openAlerts: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminServiceMock }],
    })
      // Los guards reales exigen JWT y permisos; acá se prueba la delegación,
      // no la autenticación (que tiene sus propios guards probados aparte).
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = modulo.get<AdminController>(AdminController);
  });

  const comoAdmin = { user: { role: 'rusertech_admin' } };
  const comoOperador = { user: { role: 'operator' } };

  it('lista los tenants a través del servicio cuando el rol es de plataforma', async () => {
    await expect(controller.getTenants(comoAdmin as any)).resolves.toEqual([{ id: 't1' }]);
    expect(adminServiceMock.getTenants).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 403 a cualquier rol que no sea de plataforma — el panel es solo de rusertech_admin', async () => {
    await expect(async () => controller.getTenants(comoOperador as any)).rejects.toThrow(
      'Solo administradores del sistema',
    );
    expect(adminServiceMock.getTenants).not.toHaveBeenCalled();
  });

  it('pide las estadísticas del tenant indicado, sin inventar el id', async () => {
    await controller.getTenantStats(comoAdmin as any, 't9');
    expect(adminServiceMock.getTenantStats).toHaveBeenCalledWith('t9');
  });
});
