import { Controller, Get, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { DIRECTORIO_UPLOADS, PREFIJO_UPLOADS } from './common/config/directorio-uploads';
import { direccionPublica } from './common/config/direccion-publica';

@Controller('api/v1')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Acá vivía un `@Get('alerts')` que colisionaba con AlertsController: los dos
  // registran `GET /api/v1/alerts`, y AppController se registra primero, así
  // que GANABA. Resultado: la ruta servía `getCriticalAlerts()`, que filtra
  // `severity IN ('high','critical')`, y el AlertsController completo —con
  // tenant, restricciones de acceso y todas las alertas abiertas— NUNCA corría.
  //
  // Verificado en producción durante la Tanda 5: la alerta `warning` que
  // escribió el motor no aparecía, y la pantalla decía "No se encontraron
  // incidentes abiertos". Cambiándola a `critical` a mano, aparecía.
  //
  // Se comprobó antes de borrarla quién dependía de "sólo las críticas":
  //   · AppLayout.tsx:28 → sólo quiere saber SI hay alertas abiertas para el
  //     punto rojo del menú, y ya filtra `status !== 'resolved'` por su cuenta.
  //   · alertsStore.ts:34 → quiere la lista completa.
  // Ninguno de los dos necesitaba el filtro, así que no hizo falta una ruta
  // nueva con otro nombre: la buena ya existía y estaba tapada.

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Sin guard, esta ruta era el único endpoint anónimo del backend: cualquiera
  // en internet escribía archivos de cualquier tamaño en el disco del servidor
  // y recibía la URL pública para servirlos (verificación integral, §2.5).
  // (La ruta de alertas que había arriba, y que sí llevaba guard, se eliminó
  // en la Tanda 6 por colisionar con AlertsController.)
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    // 10 MB: cubre logos, fotos de viaje y adjuntos, y deja de permitir que un
    // solo request llene el disco. Sin este límite multer acepta cualquier
    // tamaño. La lista blanca de extensiones queda para la tanda de higiene.
    limits: { fileSize: 10 * 1024 * 1024 },
    storage: diskStorage({
      // La MISMA constante que usa `useStaticAssets`. Que fueran dos rutas
      // escritas por separado es lo que producía el 404.
      destination: DIRECTORIO_UPLOADS,
      filename: (req, file, cb) => {
        // ⚠️ Encontrado al tocar esta ruta por la URL de abajo, y va con ella:
        // el nombre salía de `Math.random()`, que es un PRNG predecible, no un
        // generador criptográfico. Y `/uploads` se sirve como estático SIN
        // autenticación: quien pudiera predecir nombres leía las fotos de los
        // viajes de cualquier cliente. `randomBytes` sí es impredecible.
        cb(null, `${randomBytes(16).toString('hex')}${extname(file.originalname)}`);
      }
    })
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    // La URL sigue siendo ABSOLUTA, y eso es deliberado: en desarrollo el
    // frontend vive en :5173 y la API en :3000, así que una ruta relativa
    // resolvería contra el servidor de Vite y daría 404. Lo que cambia es de
    // dónde sale el host: `PUBLIC_API_URL`, con el 3000 local por defecto.
    // Ver common/config/direccion-publica.ts.
    return { url: `${direccionPublica()}${PREFIJO_UPLOADS}${file.filename}` };
  }
}
