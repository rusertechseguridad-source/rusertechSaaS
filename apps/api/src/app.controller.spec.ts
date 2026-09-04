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

  it('🔴 AppController ya NO registra una ruta de alertas', () => {
    // Registraba `GET /api/v1/alerts`, la misma dirección que AlertsController,
    // y como se registra primero GANABA: el módulo de alertas entero —con
    // tenant, restricciones y todas las abiertas— nunca corría. Verificado en
    // producción: la alerta `warning` del motor no aparecía.
    //
    // Esta prueba existe para que la ruta no vuelva por descuido.
    const metodos = Object.getOwnPropertyNames(AppController.prototype);
    expect(metodos).not.toContain('getAlerts');
    expect(metodos.filter((m) => /alert/i.test(m))).toEqual([]);
  });

  it('uploadFile rechaza la petición sin archivo con un error explícito', () => {
    expect(() => controller.uploadFile(undefined as any)).toThrow('No file uploaded');
  });
});
