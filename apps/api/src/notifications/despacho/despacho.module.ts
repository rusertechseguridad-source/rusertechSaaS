import { Module } from '@nestjs/common';
import { AccesoEntidadesModule } from '../../common/access/acceso-entidades.module';
import { CampanaController } from './campana.controller';
import { CampanaService } from './campana.service';
import { CanalCampanaService } from './canal-campana.service';
import { DespachoService } from './despacho.service';
import { CANALES_DE_AVISO } from './tipos-despacho';

/**
 * EL DESPACHO DE AVISOS.
 *
 * ⚠️ POR QUÉ ES SU PROPIO MÓDULO Y NO VIVE DENTRO DEL MOTOR.
 *
 * El motor decide QUÉ PASÓ. Este módulo decide QUIÉN SE ENTERA. Son dos cosas
 * con ritmos de cambio muy distintos: el catálogo de canales va a moverse en
 * las dos entregas siguientes —Telegram, correo— y el evaluador de desvío no.
 * Con esto, agregar un mensajero es agregar una clase acá y sumarla al
 * proveedor de abajo; el motor no se toca.
 *
 * `MotorModule` importa éste, y no al revés: la dependencia apunta del que
 * genera el hecho al que lo reparte, nunca de vuelta.
 *
 * ── El proveedor de canales ───────────────────────────────────────────────
 *
 * `CANALES_DE_AVISO` es la lista. Hoy tiene uno. La entrega 2 agrega
 * `CanalTelegramService` a este arreglo y a los `providers`, y no hay otro
 * lugar que editar — que es la prueba de que el punto de despacho es uno solo.
 */
@Module({
  imports: [AccesoEntidadesModule],
  controllers: [CampanaController],
  providers: [
    CanalCampanaService,
    DespachoService,
    CampanaService,
    {
      provide: CANALES_DE_AVISO,
      useFactory: (campana: CanalCampanaService) => [campana],
      inject: [CanalCampanaService],
    },
  ],
  exports: [DespachoService, CanalCampanaService],
})
export class DespachoModule {}
