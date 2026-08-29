// PRIMERA línea a propósito: carga el .env antes de que los decoradores de
// los módulos corran (deciden si registrar las colas de BullMQ leyendo
// process.env.REDIS_URL). El porqué completo está en common/config/cargar-env.
import './common/config/cargar-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DIRECTORIO_UPLOADS, PREFIJO_UPLOADS } from './common/config/directorio-uploads';
import { assertRequiredSecrets } from './common/config/secrets';
import { FiltroDeExcepciones } from './common/filters/excepciones.filter';

async function bootstrap() {
  // Falla temprano y con un mensaje claro si falta algún secreto obligatorio,
  // en lugar de levantar con una clave por defecto conocida públicamente.
  assertRequiredSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── VALIDACIÓN DEL CUERPO DE LAS PETICIONES ──────────────────────────────
  // No existía. Con 50 handlers declarados `@Body() body: any`, el cuerpo
  // entero llegaba a Prisma: bastaba mandar `tenant_id` en el JSON de
  // `PUT /vehicles/:id` para MOVER el vehículo a otro cliente.
  //
  // Alcance real, medido: el pipe sólo valida cuando el parámetro está tipado
  // con una CLASE. Donde dice `@Body() body: any` el metatipo es `Object` y el
  // pipe no hace nada. O sea que esto NO toca las 169 rutas: toca exactamente
  // las que tienen DTO, que hoy son seis. Por eso se puede encender con las dos
  // opciones estrictas de una vez, en vez de ir de a poco a ciegas.
  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta del cuerpo lo que no esté declarado en el DTO. Es lo que
      // impide la asignación masiva.
      whitelist: true,
      // Además RECHAZA la petición nombrando los campos sobrantes. Sin esto,
      // un campo de más se descartaría en silencio y la pantalla creería que
      // guardó algo que no se guardó — el mismo tipo de mentira que venimos
      // corrigiendo. Es más ruidoso a propósito.
      forbidNonWhitelisted: true,
      // Convierte el JSON plano en la instancia del DTO para que los
      // decoradores corran sobre ella.
      transform: true,
      transformOptions: {
        // Sin conversión implícita: con ella, `"año": "no soy un número"` se
        // volvería NaN y pasaría un `@IsInt`. Preferimos el 400.
        enableImplicitConversion: false,
        // Sin esto, la instancia del DTO llega al servicio con TODAS sus
        // propiedades declaradas, las que el cliente no mandó puestas en
        // `undefined` (con target ES2023, TypeScript las define igual). Prisma
        // ignora las claves `undefined`, así que no rompe nada, pero el objeto
        // que recibe el servicio deja de ser lo que el cliente envió — y
        // cualquier código que haga `Object.keys(data)` ve campos fantasma.
        exposeUnsetFields: false,
      },
    }),
  );

  // Traduce los errores conocidos de Prisma a códigos HTTP con sentido y
  // registra tenant, usuario y ruta. Antes, un fallo de la base llegaba como
  // 500 mudo y al log sin ningún dato para ubicarlo.
  app.useGlobalFilters(new FiltroDeExcepciones());

  // La carpeta la define UN solo módulo. Antes esto resolvía a `dist/uploads`
  // mientras multer escribía en `<cwd>/uploads`: toda foto subida daba 404.
  app.useStaticAssets(DIRECTORIO_UPLOADS, { prefix: PREFIJO_UPLOADS });

  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
