import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Era la plantilla de NestJS ("should be defined") sin proveer PrismaService:
 * fallaba en el armado del módulo desde siempre. Ahora prueba la lógica que
 * esta auditoría corrigió: el conteo de viajes activos POR NEGACIÓN contra el
 * catálogo de estados — el contador viejo preguntaba por valores que ningún
 * escritor produce y el panel mostraba 0 estructuralmente (Fase B).
 */
describe('AdminService', () => {
  let service: AdminService;

  // AdminService pasó a depender de MailService en la Tanda 1: el correo de
  // alta era un mock de `console.log` que imprimía la contraseña temporal.
  const mailMock = { sendInvitation: jest.fn(), sendVehicleBlockedAlert: jest.fn() };

  const prismaMock: any = {
    tenant: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    vehicle: { count: jest.fn() },
    eventLog: { count: jest.fn() },
    $queryRaw: jest.fn(),
    // `createTenant` corre dentro de una transacción con callback; el mock la
    // ejecuta con el mismo objeto, que es lo que hace Prisma en la práctica.
    $transaction: jest.fn((cb: any) => cb(prismaMock)),
    user: { create: jest.fn(), update: jest.fn() },
    carbonSetting: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = modulo.get<AdminService>(AdminService);
  });

  describe('getTenantStats', () => {
    it('rechaza con 404 un tenant inexistente, antes de contar nada', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getTenantStats('no-existe')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.vehicle.count).not.toHaveBeenCalled();
    });

    it('cuenta los viajes activos por negación contra el catálogo, y convierte el bigint', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 't1', name: 'Cliente' });
      prismaMock.vehicle.count.mockResolvedValue(7);
      prismaMock.eventLog.count.mockResolvedValue(2);
      // Postgres devuelve count(*) como bigint; el servicio debe convertirlo a
      // number o el JSON de la respuesta explota en la serialización.
      prismaMock.$queryRaw.mockResolvedValue([{ activos: 5n }]);

      const stats = await service.getTenantStats('t1');

      expect(stats).toEqual({ vehicles: 7, activeTrips: 5, openAlerts: 2 });
      expect(typeof stats.activeTrips).toBe('number');
      // La consulta tiene que excluir por es_terminal, no enumerar estados: un
      // estado desconocido debe VERSE en el número, no desaparecer de él.
      const sqlEnviado = prismaMock.$queryRaw.mock.calls[0][0].join('');
      expect(sqlEnviado).toContain('es_terminal');
      expect(sqlEnviado).toContain('NOT IN');
    });
  });

  describe('createTenant · el correo de alta', () => {
    // El envío era un mock de seis `console.log`, uno de ellos con la
    // contraseña temporal en texto plano (verificación integral, §2.6).
    const alta = {
      name: 'Transportes Sur', slug: 'transportes-sur', plan: 'starter',
      adminEmail: 'dueno@sur.com', adminFullName: 'Ana Pérez',
    };

    beforeEach(() => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue({ id: 't9', name: 'Transportes Sur' });
      prismaMock.user.create.mockResolvedValue({ id: 'u9', email: alta.adminEmail, full_name: alta.adminFullName });
      prismaMock.carbonSetting.create.mockResolvedValue({});
    });

    it('manda la clave por correo y NO la escribe en la salida del proceso', async () => {
      const espiaLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      // ⚠️ EL CONTRATO DE `sendInvitation` CAMBIÓ EN LA TANDA 7, y el mock
      // tenía que seguirlo. Antes se comunicaba por excepciones; ahora
      // devuelve `{ enviado, ... }` y NUNCA lanza, porque el SDK de Resend
      // resuelve con `{ data: null, error }` cuando la API rechaza el envío y
      // el `try/catch` de antes no veía nada. Lo que esta prueba afirma no
      // cambió: la clave se manda por correo y no se imprime.
      mailMock.sendInvitation.mockResolvedValue({ enviado: true, id: 'msg-1' });

      const respuesta = await service.createTenant(alta);

      expect(mailMock.sendInvitation).toHaveBeenCalledTimes(1);
      const enviado = mailMock.sendInvitation.mock.calls[0][0];
      expect(enviado.to).toBe(alta.adminEmail);
      expect(enviado.tempPassword).toEqual(expect.any(String));
      // El nombre del tenant, no el slug: es lo que lee el destinatario.
      expect(enviado.tenantName).toBe('Transportes Sur');
      expect(respuesta.emailSent).toBe(true);

      // La afirmación que da nombre a la corrección: la contraseña no aparece
      // en ninguna línea impresa por el proceso.
      const impreso = espiaLog.mock.calls.flat().join(' ');
      expect(impreso).not.toContain(enviado.tempPassword);
      espiaLog.mockRestore();
    });

    it('si el correo falla, el tenant sobrevive pero la respuesta lo dice', async () => {
      // Sin este aviso el tenant nace inaccesible en silencio: la clave ya no
      // queda en ningún otro lado.
      //
      // El fallo se simula como lo devuelve HOY el servicio —RESUELTO, no
      // lanzado—, que es exactamente el caso que antes se colaba: la cuenta de
      // Resend en modo de prueba rechaza el envío SIN lanzar, así que el
      // `try/catch` de la versión anterior no lo veía y esto devolvía `true`.
      mailMock.sendInvitation.mockResolvedValue({
        enviado: false,
        motivo: 'La cuenta de Resend está en modo de prueba.',
      });

      const respuesta = await service.createTenant(alta);

      expect(respuesta.tenantId).toBe('t9');
      expect(respuesta.emailSent).toBe(false);
    });

    it('un fallo INESPERADO del cliente de correo tampoco tira abajo el alta', async () => {
      // `sendInvitation` se comprometió a no lanzar, pero esto corre DESPUÉS de
      // que la transacción confirmó: el tenant ya existe y un error del cliente
      // de correo no puede convertirlo en un 500. De ahí el `try/catch` que se
      // conserva como red de seguridad, no como mecanismo.
      mailMock.sendInvitation.mockRejectedValue(new Error('el SDK explotó'));

      const respuesta = await service.createTenant(alta);

      expect(respuesta.tenantId).toBe('t9');
      expect(respuesta.emailSent).toBe(false);
    });
  });
});
