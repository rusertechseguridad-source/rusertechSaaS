import { Controller, Get, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { DIRECTORIO_UPLOADS, PREFIJO_UPLOADS } from './common/config/directorio-uploads';

@Controller('api/v1')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('alerts')
  @UseGuards(JwtAuthGuard)
  getAlerts(@CurrentUser() user: any) {
    return this.appService.getCriticalAlerts(user.tenantId);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Sin guard, esta ruta era el único endpoint anónimo del backend: cualquiera
  // en internet escribía archivos de cualquier tamaño en el disco del servidor
  // y recibía la URL pública para servirlos (verificación integral, §2.5).
  // El `@Get('alerts')` de arriba, en este mismo archivo, sí lo tenía.
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
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    // ⚠️ La URL absoluta a localhost se DEJA como está. Es una de las 164 que
    // atan la aplicación a localhost (Tanda 7), pero acá es carga útil: el
    // frontend corre en :5173 y la API en :3000, así que una ruta relativa
    // resolvería contra el servidor de Vite y daría 404. Cambiarla sin mover
    // también el origen sería introducir el mismo error que esta corrección
    // viene a arreglar.
    return { url: `http://localhost:3000${PREFIJO_UPLOADS}${file.filename}` };
  }
}
