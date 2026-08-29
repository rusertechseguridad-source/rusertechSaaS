import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { ColaService } from './cola.service';
import { VehiculosActivosService } from './vehiculos-activos.service';
import { MotorConfigService } from './motor-config.service';
import { isAdminRole } from '../common/constants/admin-roles';

/**
 * API DEL MOTOR.
 *
 * Dos cosas distintas:
 *  · los CATÁLOGOS, que el frontend necesita para dejar de tener listas de
 *    valores escritas a mano — la pantalla de protocolos filtraba por valores
 *    que no existen en la base y devolvía siempre cero filas.
 *  · el MONITOR, para ver si el motor está al día.
 */
@Controller('api/v1/motor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MotorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cola: ColaService,
    private readonly activos: VehiculosActivosService,
    private readonly config: MotorConfigService,
  ) {}

  /**
   * Catálogos del motor, en una sola respuesta.
   *
   * Va junto a propósito: son cuatro listas chicas que la UI necesita al mismo
   * tiempo para armar sus filtros. Cuatro pedidos separados serían cuatro
   * viajes de red para dibujar un formulario.
   */
  @Get('catalogos')
  async catalogos() {
    const [niveles, estados, condiciones, contexto] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT codigo, nombre, descripcion, orden, color, sla_minutos, requiere_atencion_operador
        FROM motor_niveles_riesgo WHERE is_active AND tenant_id IS NULL ORDER BY orden
      `,
      this.prisma.$queryRaw`
        SELECT codigo, nombre, descripcion, orden, monitoreable, es_terminal, color
        FROM motor_estados_viaje WHERE is_active ORDER BY orden
      `,
      this.prisma.$queryRaw`
        SELECT codigo, nombre, descripcion, familia, riesgo_default,
               resolucion, detectable_sin_app, requiere_datos_faltantes
        FROM motor_tipos_condicion WHERE is_active ORDER BY familia, codigo
      `,
      this.prisma.$queryRaw`
        SELECT dimension, codigo, nombre, orden, umbral_minutos
        FROM motor_valores_contexto WHERE is_active ORDER BY dimension, orden
      `,
    ]);

    return { niveles_riesgo: niveles, estados_viaje: estados, tipos_condicion: condiciones, valores_contexto: contexto };
  }

  /**
   * Salud del motor.
   *
   * `antiguedad_segundos` es el indicador que importa: si crece de forma
   * sostenida, el motor no da abasto. Un número alto puntual después de un
   * reinicio es normal.
   */
  /**
   * Precisión del recorrido guardado (E7). Lectura para cualquiera que vea la
   * pantalla del motor; edición con `manage_settings` — que en el seed tienen
   * exactamente `account_owner` (su tenant) y `rusertech_admin`: la misma
   * regla que el resto de la configuración.
   */
  @Get('config/recorrido')
  async toleranciaRecorrido(@CurrentUser() user: any) {
    return this.config.obtenerToleranciaRecorrido(user.tenantId);
  }

  @Post('config/recorrido')
  @RequirePermissions('manage_settings')
  async cambiarToleranciaRecorrido(
    @CurrentUser() user: any,
    @Body() body: { tolerancia_m: number; tenant_id?: string },
  ) {
    // `rusertech_admin` puede ajustar el valor de cualquier tenant; el resto
    // sólo el propio. Un tenant_id ajeno de un no-admin se ignora a propósito
    // (no 403: el campo simplemente no existe para ese rol).
    const esAdminPlataforma = user.role === 'rusertech_admin';
    const tenantObjetivo = esAdminPlataforma && body.tenant_id ? body.tenant_id : user.tenantId;
    return this.config.cambiarToleranciaRecorrido(tenantObjetivo, body.tolerancia_m);
  }

  @Get('salud')
  @RequirePermissions('view_settings')
  async salud(@CurrentUser() user: any) {
    // El monitor de un cliente muestra SU cola. La vista global queda para el
    // administrador de plataforma, que es quien tiene que ver el sistema entero.
    // `isAdminRole` y no una lista suelta: es la fuente única (ADMIN_ROLES).
    const tenantId = isAdminRole(user?.role)
      ? null
      : requireTenantId(user?.tenantId, 'MotorController.salud');
    return this.cola.salud(tenantId);
  }

  /** Qué vehículos se están monitoreando y por qué. */
  @Get('monitoreados')
  @RequirePermissions('view_settings')
  async monitoreados(@CurrentUser() user: any) {
    return this.activos.listar(requireTenantId(user?.tenantId, 'MotorController.monitoreados'));
  }

  /** Activación manual del monitoreo de un vehículo. */
  @Post('monitoreados/:vehicleId')
  @RequirePermissions('manage_settings')
  async activar(
    @Param('vehicleId') vehicleId: string,
    @Body() body: { trip_id?: string },
    @CurrentUser() user: any,
  ) {
    const tenantId = requireTenantId(user?.tenantId, 'MotorController.activar');
    await this.activos.activarManual(vehicleId, tenantId, body?.trip_id ?? null);
    return { ok: true };
  }

  @Delete('monitoreados/:vehicleId')
  @RequirePermissions('manage_settings')
  async desactivar(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    const tenantId = requireTenantId(user?.tenantId, 'MotorController.desactivar');
    await this.activos.desactivar(vehicleId, tenantId);
    return { ok: true };
  }

  /**
   * Historial de estados de un viaje: qué lo cambió y cuándo.
   *
   * Es la respuesta a "¿por qué este viaje cambió de estado?", que sin esto
   * sólo se podía contestar mirando la base.
   */
  @Get('viajes/:tripId/historial')
  async historial(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const tenantId = requireTenantId(user?.tenantId, 'MotorController.historial');
    return this.prisma.$queryRaw`
      SELECT h.id::text, h.estado_anterior, h.estado_nuevo, h.disparado_por,
             h.causa_detalle, h.automatico, h.created_at,
             ea.nombre AS nombre_anterior, en.nombre AS nombre_nuevo, en.color
      FROM trip_state_history h
      LEFT JOIN motor_estados_viaje ea ON ea.codigo = h.estado_anterior
      LEFT JOIN motor_estados_viaje en ON en.codigo = h.estado_nuevo
      WHERE h.trip_id = ${tripId}::uuid
        AND h.tenant_id = ${tenantId}::uuid
      ORDER BY h.created_at ASC
    `;
  }
}
