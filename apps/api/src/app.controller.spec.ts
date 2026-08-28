import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Esta suite era la plantilla de NestJS: esperaba "Hello World!", que no es lo
 * que devuelve el servicio real, y fallaba desde siempre. Una prueba que falla
 * siempre enseña a ignorar el resultado de las pruebas — peor que no tenerla.
 *
 * Ahora prueba el CONTRATO del controller con el servicio mockeado: que cada
 * endpoint delega en el método correcto con los argumentos correctos. La
 * lógica real vive en AppService y se prueba aparte.
 */
describe('AppController', () => {
  let controller: AppController;

  const appServiceMock = {
    getHello: jest.fn().mockReturnValue('Rusertech API'),
    getCriticalAlerts: jest.fn().mockResolvedValue([{ id: 'a1' }]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    }).compile();

    controller = modulo.get<AppController>(AppController);
  });

  it('getHello devuelve lo que responde el servicio, sin transformarlo', () => {
    expect(controller.getHello()).toBe('Rusertech API');
    expect(appServiceMock.getHello).toHaveBeenCalledTimes(1);
  });

  it('getAlerts delega con el tenant del usuario autenticado — nunca sin tenant', async () => {
    const user = { tenantId: 'tenant-1' };
    await expect(controller.getAlerts(user)).resolves.toEqual([{ id: 'a1' }]);
    expect(appServiceMock.getCriticalAlerts).toHaveBeenCalledWith('tenant-1');
  });

  it('uploadFile rechaza la petición sin archivo con un error explícito', () => {
    expect(() => controller.uploadFile(undefined as any)).toThrow('No file uploaded');
  });
});
