import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  // `getCriticalAlerts` se eliminó con la ruta que la usaba: filtraba
  // `severity IN ('high','critical')` —un vocabulario que ningún escritor
  // produce— y su ruta tapaba al AlertsController entero. Si algún día hace
  // falta un panel de "sólo críticas", va con su propio nombre de ruta, no
  // reusando la dirección de otra cosa.
}
