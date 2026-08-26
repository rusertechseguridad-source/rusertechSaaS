import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { InformeService } from './informe.service';
import { InformeDatosService } from './informe-datos.service';
import { ReportesService } from './reportes.service';
import { TrabajosService } from '../motor/trabajos.service';

/**
 * INFORMES Y REPORTES.
 *
 * Permisos: ver informes es OPERACIÓN, no configuración — cualquier rol con
 * `view_analytics` accede. La regla de "solo administradores" aplica a la
 * configuración, y acá no se configura nada.
 */
@Controller('api/v1/informes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InformesController {
  constructor(
    private readonly informe: InformeService,
    private readonly reportes: ReportesService,
    private readonly trabajos: TrabajosService,
    private readonly datos: InformeDatosService,
  ) {}

  /**
   * El informe del viaje. `?formato=html` fuerza el HTML imprimible; sin eso
   * intenta PDF y, si Chromium no está disponible, cae al HTML con un aviso
   * en el encabezado HTTP para que el frontend pueda explicarlo.
   */
  @Get('viajes/:tripId')
  // Definición de producto: el informe lo emite quien tiene la
  // responsabilidad (account_owner, rusertech_admin, o un rol al que se le
  // asigne explícitamente). Ver los datos en pantalla sigue siendo view_trips;
  // emitir el documento que se archiva, no.
  @RequirePermissions('generate_reports')
  async informeDeViaje(
    @Param('tripId') tripId: string,
    @Query('formato') formato: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const tenantId = requireTenantId(user?.tenantId, 'InformesController.informeDeViaje');

    if (formato !== 'html') {
      const pdf = await this.informe.generarPdf(tripId, tenantId);
      if (pdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="informe-${tripId}.pdf"`);
        return res.send(pdf);
      }
      // Sin Chromium: se sirve el HTML y se avisa por header.
      res.setHeader('X-Informe-Fallback', 'html');
    }

    const html = await this.informe.generarHtml(tripId, tenantId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  /**
   * Estado del resumen del viaje: si existe, y si hay un trabajo en cola.
   *
   * Existe para que el botón del informe pueda EXPLICARSE en vez de
   * esconderse: "calculando", "falló, reintentar" o listo. Un botón ausente es
   * indistinguible de una función que no existe.
   */
  @Get('viajes/:tripId/estado')
  @RequirePermissions('view_trips')
  async estadoResumen(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const tenantId = requireTenantId(user?.tenantId, 'InformesController.estadoResumen');
    const [fila] = await this.datos.estadoResumen(tripId, tenantId);
    return fila ?? { tiene_resumen: false, trabajo: null, trabajo_error: null };
  }

  /** Recalcular el resumen a demanda. Encola: mismo camino que el cierre. */
  @Post('viajes/:tripId/recalcular')
  @RequirePermissions('generate_reports')
  async recalcular(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const tenantId = requireTenantId(user?.tenantId, 'InformesController.recalcular');
    await this.trabajos.encolarRecalculo(tripId, tenantId);
    return { ok: true, mensaje: 'Recálculo encolado. El resumen se actualiza en segundos.' };
  }

  // ── Reportes agregados: todos leen de trip_summary, nunca de telemetry ────

  @Get('reportes/vehiculos')
  @RequirePermissions('view_analytics')
  porVehiculo(@CurrentUser() user: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.porVehiculo(user?.tenantId, desde, hasta);
  }

  @Get('reportes/conductores')
  @RequirePermissions('view_analytics')
  porConductor(@CurrentUser() user: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.porConductor(user?.tenantId, desde, hasta);
  }

  @Get('reportes/rutas')
  @RequirePermissions('view_analytics')
  porRuta(@CurrentUser() user: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.porRuta(user?.tenantId, desde, hasta);
  }

  @Get('reportes/paradas-no-declaradas')
  @RequirePermissions('view_analytics')
  paradasNoDeclaradas(@CurrentUser() user: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.paradasNoDeclaradas(user?.tenantId, desde, hasta);
  }

  @Get('reportes/cadena-frio')
  @RequirePermissions('view_analytics')
  cadenaDeFrio(@CurrentUser() user: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.cadenaDeFrio(user?.tenantId, desde, hasta);
  }
}
