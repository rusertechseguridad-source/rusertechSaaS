import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { LimitePeticionesGuard, LimitarPeticiones } from '../common/guards/limite-peticiones.guard';

@Controller('api/v1/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  // El "in a real scenario podríamos limitar acá" que había en el cuerpo, hecho.
  //
  // El límite va ANTES de `ApiKeyGuard` por lo mismo que en el login: si fuera
  // después, cada petición rechazada ya habría costado la consulta de la clave
  // contra la base. Acá pesa más todavía, porque el ingest es la ruta con más
  // tráfico del sistema.
  //
  // 600 por minuto por origen ≈ 10 por segundo. Es holgado para un proveedor
  // real —el HUB manda por lotes, no punto a punto— y corta una integración en
  // bucle antes de que llene `telemetry`. Si un proveedor legítimo lo alcanza,
  // el 429 lo dice y el número se sube: el objetivo es que exista un techo, no
  // adivinar el techo exacto.
  //
  // ⚠️ El origen es la IP, no la clave de API: el límite corre ANTES de que se
  // valide la clave, así que en ese momento no se sabe de quién es. Es lo
  // correcto para proteger el servidor; un límite por cliente (por clave) es
  // otra cosa y necesita el contador compartido en Redis.
  @Post('ingest')
  @UseGuards(LimitePeticionesGuard, ApiKeyGuard)
  @LimitarPeticiones({ nombre: 'ingest', intentos: 600, ventanaSegundos: 60 })
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Req() req: any, @Body() payload: any) {
    const { avlUserId, tenantId } = req.avlUser;
    return this.telemetryService.processIngest(payload, avlUserId, tenantId);
  }
}
