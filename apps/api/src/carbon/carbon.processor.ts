import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { descifrarSecreto, CONTEXTO } from '../common/crypto/secretos-cifrados';
import { Logger } from '@nestjs/common';

@Processor('carbon')
export class CarbonProcessor extends WorkerHost {
  private readonly logger = new Logger(CarbonProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'carbon.calculate') {
      const { tripId, vehicleId, tenantId, isFinal, isRecalculation } = job.data;
      this.logger.log(`Processing carbon.calculate for trip ${tripId}`);

      try {
        const trip = await this.prisma.trip.findUnique({
          where: { id: tripId },
          include: { vehicle: true },
        });

        if (!trip || !trip.vehicle) {
          throw new Error('Trip or vehicle not found');
        }

        const actual_start = trip.actual_start || trip.planned_start;
        const actual_end = trip.actual_end || new Date(); // If not final, use now

        // Calculate distance via PostGIS
        const distanceResult: any = await this.prisma.$queryRaw`
          WITH telemetry_with_prev AS (
            SELECT location, LAG(location) OVER (ORDER BY timestamp ASC) as prev_location
            FROM telemetry
            WHERE vehicle_id = ${vehicleId}::uuid
              AND timestamp >= ${actual_start}
              AND timestamp <= ${actual_end}
          )
          SELECT SUM(ST_Distance(prev_location, location)) / 1000 as km
          FROM telemetry_with_prev
          WHERE prev_location IS NOT NULL AND location IS NOT NULL
        `;

        let distance_km = 0;
        if (distanceResult && distanceResult.length > 0 && distanceResult[0].km) {
          distance_km = parseFloat(distanceResult[0].km);
        }

        // Calculate avg speed
        const speedResult: any = await this.prisma.$queryRaw`
          SELECT AVG(speed_kmh) as avg_speed
          FROM telemetry
          WHERE vehicle_id = ${vehicleId}::uuid
            AND timestamp >= ${actual_start}
            AND timestamp <= ${actual_end}
        `;
        let avg_speed_kmh = null;
        if (speedResult && speedResult.length > 0 && speedResult[0].avg_speed) {
          avg_speed_kmh = parseFloat(speedResult[0].avg_speed);
        }

        // Vehicle info and fallback
        const fuel_type = trip.vehicle.fuel_type || 'diesel';
        const vehicle_type = trip.vehicle.vehicle_type || 'truck';
        
        let fuel_efficiency = trip.vehicle.fuel_efficiency_lper100km;
        if (!fuel_efficiency) {
          // Fallback based on vehicle_type
          switch (vehicle_type.toLowerCase()) {
            case 'car': fuel_efficiency = 8 as any; break;
            case 'van': fuel_efficiency = 15 as any; break;
            case 'motorcycle': fuel_efficiency = 4 as any; break;
            case 'truck': default: fuel_efficiency = 35 as any; break;
          }
        }

        const fuel_efficiency_num = Number(fuel_efficiency);
        const fuel_liters = (distance_km / 100) * fuel_efficiency_num;

        // Settings
        const settings = await this.prisma.carbonSetting.findUnique({
          where: { tenant_id: tenantId },
        });

        // La clave se descifra ACÁ, en el único punto que la consume, y no sale
        // de esta función. `descifrarSecreto` devuelve el texto plano tal cual
        // si el valor es anterior a la Tanda 7 (`esLegado`), así que un tenant
        // que ya tenía su clave guardada sigue calculando sin migración previa.
        const claveClimatiq = (() => {
          if (!settings?.climatiq_api_key) return null;
          try {
            const { valor, esLegado } = descifrarSecreto(
              settings.climatiq_api_key,
              CONTEXTO.climatiqApiKey,
            );
            if (esLegado) {
              this.logger.warn(
                `El tenant ${tenantId} guarda su clave de Climatiq en texto plano. ` +
                  'Se cifra sola la próxima vez que se guarde desde la pantalla.',
              );
            }
            return valor;
          } catch (error) {
            // Una clave indescifrable NO tumba el cálculo: se cae a la fórmula,
            // que es el método por defecto, y queda dicho por qué. Lanzar acá
            // dejaría sin huella de carbono a todo el tenant por un problema de
            // configuración de una integración opcional.
            this.logger.error(
              `No se pudo descifrar la clave de Climatiq del tenant ${tenantId}: ` +
                `${(error as Error).message} Se calcula por fórmula.`,
            );
            return null;
          }
        })();

        const useClimatiq = settings?.use_climatiq_api && claveClimatiq;
        let co2_kg = 0;
        let method = 'formula';
        let climatiq_response = null;

        if (useClimatiq) {
          // Try Climatiq API
          method = 'climatiq_api';
          let retries = 3;
          let success = false;
          
          while (retries > 0 && !success) {
            try {
              const res = await fetch('https://api.climatiq.io/data/v1/estimate', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${claveClimatiq}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  emission_factor: { 
                    activity_id: `fuel_combustion-${fuel_type === 'gasoline' ? 'motor_gasoline' : fuel_type}`, 
                    data_version: "^5" 
                  },
                  parameters: { volume: fuel_liters, volume_unit: "l" }
                })
              });
              
              if (!res.ok) {
                const text = await res.text();
                this.logger.warn(`Climatiq API error: ${text}`);
                throw new Error('Climatiq API non-200 response');
              }
              
              const json: any = await res.json();
              if (json && json.co2e) {
                co2_kg = json.co2e;
                climatiq_response = json;
                success = true;
              } else {
                throw new Error('Invalid Climatiq response');
              }
            } catch (err) {
              retries--;
              if (retries === 0) {
                // Fallback
                method = 'fallback_formula';
              } else {
                // Wait before retry
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }
        }

        // Apply internal formula if needed
        if (method === 'formula' || method === 'fallback_formula') {
          if (fuel_type === 'electric') {
            co2_kg = 0;
          } else if (fuel_type === 'hybrid') {
            co2_kg = fuel_liters * 1.90;
          } else if (fuel_type === 'gasoline') {
            co2_kg = fuel_liters * 2.31;
          } else { // diesel or default
            co2_kg = fuel_liters * 2.68;
          }
        }

        // Upsert into CarbonLog
        const existingLog = await this.prisma.carbonLog.findFirst({
          where: { trip_id: tripId }
        });

        if (existingLog) {
          await this.prisma.carbonLog.update({
            where: { id: existingLog.id },
            data: {
              distance_km,
              avg_speed_kmh,
              fuel_liters,
              co2_kg,
              calculation_method: method,
              climatiq_response: climatiq_response || undefined,
              period_start: actual_start,
              period_end: actual_end,
              calculated_at: new Date(),
            }
          });
        } else {
          await this.prisma.carbonLog.create({
            data: {
              tenant_id: tenantId,
              vehicle_id: vehicleId,
              trip_id: tripId,
              period_start: actual_start,
              period_end: actual_end,
              distance_km,
              avg_speed_kmh,
              fuel_liters,
              co2_kg,
              calculation_method: method,
              climatiq_response: climatiq_response || undefined,
            }
          });
        }

        this.logger.log(`Carbon calculation for trip ${tripId} finished. Method: ${method}, CO2: ${co2_kg}kg`);
        return { success: true, method, co2_kg };

      } catch (err: any) {
        this.logger.error(`Error calculating carbon for trip ${tripId}: ${err.message}`, err.stack);
        throw err;
      }
    }
  }
}
