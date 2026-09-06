// PRIMERA línea a propósito: carga el .env antes de que los decoradores de
// los módulos corran (deciden si registrar las colas de BullMQ leyendo
// process.env.REDIS_URL). El porqué completo está en common/config/cargar-env.
import './common/config/cargar-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DIRECTORIO_UPLOADS, PREFIJO_UPLOADS } from './common/config/directorio-uploads';
import { FiltroDeExcepciones } from './common/filters/excepciones.filter';
import { verificarConfiguracion } from './common/config/verificar-configuracion';
import { origenesPermitidos, direccionPublica } from './common/config/direccion-publica';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // Falla temprano y con un mensaje claro si la configuración no permite
  // funcionar, en lugar de levantar rota.
  //
  // Antes acá estaba `assertRequiredSecrets()`, que miraba sólo los dos
  // secretos de JWT. `verificarConfiguracion()` lo incluye y agrega la base,
  // la clave de cifrado, CORS, la dirección pública, Redis y el correo — y
  // junta TODOS los problemas en un solo mensaje, en vez de obligar a
  // descubrirlos de a uno reiniciando entre cada uno.
  const avisos = verificarConfiguracion();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Los avisos se registran recién acá porque el logger de Nest no existe
  // antes de crear la aplicación. Son cosas que NO impiden arrancar pero que
  // dejan algo degradado, y quedar en silencio sobre ellas es cómo se
  // descubren tres semanas después.
  const log = new Logger('Configuración');
  for (const aviso of avisos) log.warn(aviso);

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

  // Los orígenes salían de dos literales de localhost escritos acá. En un
  // servidor, el navegador bloqueaba todas las llamadas del frontend aunque la
  // API respondiera perfectamente — y el síntoma (una pantalla vacía) no se
  // parece en nada a la causa. Ahora salen de `CORS_ORIGIN`, con los de
  // desarrollo por defecto. Ver common/config/direccion-publica.ts.
  const origenes = origenesPermitidos();
  app.enableCors({ origin: origenes, credentials: true });

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto);

  // Una línea al arrancar con lo que quedó configurado. Es lo primero que se
  // mira cuando algo no anda en un servidor, y evita tener que adivinar qué
  // valores tomó el proceso.
  new Logger('Arranque').log(
    `API escuchando en :${puerto} · dirección pública ${direccionPublica()} · ` +
      `CORS para ${origenes.join(', ')}`,
  );
}
bootstrap();
