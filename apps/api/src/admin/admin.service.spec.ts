import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Era la plantilla de NestJS ("should be defined") sin proveer PrismaService:
 * fallaba en el armado del módulo desde siempre. Ahora prueba la lógica que
 * esta auditoría corrigió: el conteo de viajes activos POR NEGACIÓN contra el
 * catálogo de estados — el contador viejo preguntaba por valores que ningún
 * escritor produce y el panel mostraba 0 estructuralmente (Fase B).
 */
describe('AdminService', () => {
  let service: AdminService;

  const prismaMock = {
    tenant: { findUnique: jest.fn(), findMany: jest.fn() },
    vehicle: { count: jest.fn() },
    eventLog: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prismaMock }],
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
});
