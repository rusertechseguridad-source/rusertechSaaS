import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { assertRequiredSecrets } from './common/config/secrets';

async function bootstrap() {
  // Falla temprano y con un mensaje claro si falta algún secreto obligatorio,
  // en lugar de levantar con una clave por defecto conocida públicamente.
  assertRequiredSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
