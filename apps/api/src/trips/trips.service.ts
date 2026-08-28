import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CarbonService } from '../carbon/carbon.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { AccesoEntidadesService } from '../common/access/acceso-entidades.service';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(private prisma: PrismaService, private carbonService: CarbonService,
    private readonly acceso: AccesoEntidadesService,
  ) {}

  /** Verifica que el viaje pertenezca al tenant antes de leerlo o modificarlo. */
  private async assertViajeDelTenant(id: string, tenantId: string) {
    return assertTenantOwnership(this.prisma.trip, id, tenantId, 'Viaje');
  }

  private mapToDto(trip: any) {
    if (!trip) return null;
    const dto = {
      ...trip,
      scheduled_start: trip.planned_start,
      scheduled_end: trip.planned_end,
    };

    if (trip.trip_events) {
      dto.events = trip.trip_events.map((evt: any) => ({
        id: evt.id,
        generated_at: evt.timestamp,
        event_name: evt.event_type,
        lat: evt.latitude,
        lng: evt.longitude,
        speed: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).speed : null,
        address: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).address : null,
        temperature_c: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).temperature_c : null,
        humidity_pct: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).humidity_pct : null,
      }));
    }

    return dto;
  }

  async findAll(user: any) {
    // Punto único: la política de restricciones vive en AccesoEntidadesService.
    // Antes esta condición estaba repetida en tres servicios y fallaba en
    // ABIERTO — cualquier forma inesperada del jsonb dejaba la consulta sin
    // filtro. Ahora una forma ilegible deniega y queda registrada.
    const restrictions = await this.acceso.filtroPara(user, 'vehicles', 'vehicle_id');

    const trips = await this.prisma.trip.findMany({
      where: { 
        tenant_id: user.tenantId,
        ...restrictions
      },
      include: {
        vehicle: {
          include: { avl_user: true, carrier: true }
        },
        carrier: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
        trip_events: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { planned_start: 'desc' }
    });
    return trips.map(t => this.mapToDto(t));
  }

  async findOne(id: string, tenantId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: tenantWhere(tenantId, 'TripsService.findOne', { id }),
      include: {
        vehicle: {
          include: { avl_user: true, carrier: true }
        },
        carrier: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
        trip_events: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');

    const dto = this.mapToDto(trip) as any;
    
    if (trip.route_id && dto.route) {
      // SQL parametrizado: antes se interpolaba route_id directamente en el
      // string, un patrón replicado en varios servicios y peligroso en cuanto
      // el valor deje de venir de una fila propia.
      const geo: any = await this.prisma.$queryRaw`SELECT ST_AsGeoJSON(geometry) as geojson FROM "routes" WHERE id = ${trip.route_id}::uuid`;
      if (geo && geo[0] && geo[0].geojson) {
        dto.route.geojson = JSON.parse(geo[0].geojson);
      }
    }
    
    return dto;
  }

  async create(data: any, tenantId: string, userId: string) {
    let origin_name = null;
    let origin_address = null;
    let origin_lat = null;
    let origin_lng = null;
    if (data.origin_location_id) {
      const loc = await this.prisma.savedLocation.findFirst({
        where: tenantWhere(tenantId, 'TripsService.create.origin', { id: data.origin_location_id })
      });
      if (loc) {
        origin_name = loc.name;
        origin_address = loc.address;
        origin_lat = loc.latitude;
        origin_lng = loc.longitude;
      }
    }

    let destination_name = null;
    let destination_address = null;
    let destination_lat = null;
    let destination_lng = null;
    if (data.destination_location_id) {
      const loc = await this.prisma.savedLocation.findFirst({
        where: tenantWhere(tenantId, 'TripsService.create.destination', { id: data.destination_location_id })
      });
      if (loc) {
        destination_name = loc.name;
        destination_address = loc.address;
        destination_lat = loc.latitude;
        destination_lng = loc.longitude;
      }
    }

    const planned_start = new Date(data.scheduled_start);
    const planned_end = data.scheduled_end 
      ? new Date(data.scheduled_end) 
      : new Date(planned_start.getTime() + 24 * 60 * 60 * 1000);

    // El estado inicial se valida contra el catálogo si viene explícito. El
    // default 'PROGRAMADO' es una decisión de producto de este endpoint (un
    // viaje creado desde la web nace confirmado, no en borrador) y no depende
    // del default de la columna — que además lo aplica Prisma, no la base.
    const estadoInicial = data.status || 'PROGRAMADO';
    if (data.status) {
      await this.assertEstadoValido(data.status);
    }

    const trip = await this.prisma.trip.create({
      data: {
        name: data.name || '',
        trip_code: data.trip_code || null,
        status: estadoInicial,
        planned_start,
        planned_end,
        vehicle: data.vehicle_id ? { connect: { id: data.vehicle_id } } : undefined,
        carrier: data.carrier_id ? { connect: { id: data.carrier_id } } : undefined,
        operation: data.operation_id ? { connect: { id: data.operation_id } } : undefined,
        origin_location: data.origin_location_id ? { connect: { id: data.origin_location_id } } : undefined,
        destination_location: data.destination_location_id ? { connect: { id: data.destination_location_id } } : undefined,
        route: data.route_id ? { connect: { id: data.route_id } } : undefined,
        tenant: { connect: { id: tenantId } },
        created_by: { connect: { id: userId } },
        origin_name,
        origin_address,
        origin_lat,
        origin_lng,
        destination_name,
        destination_address,
        destination_lat,
        destination_lng,
      },
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    return this.mapToDto(trip);
  }

  async update(id: string, tenantId: string, data: any) {
    await this.assertViajeDelTenant(id, tenantId);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.trip_code !== undefined) updateData.trip_code = data.trip_code;
    if (data.status !== undefined) {
      await this.assertEstadoValido(data.status);
      updateData.status = data.status;
    }
    
    if (data.scheduled_start !== undefined) {
      updateData.planned_start = new Date(data.scheduled_start);
    }
    if (data.scheduled_end !== undefined) {
      updateData.planned_end = data.scheduled_end ? new Date(data.scheduled_end) : undefined;
    }
    if (data.actual_start !== undefined) {
      updateData.actual_start = data.actual_start ? new Date(data.actual_start) : null;
    }
    if (data.actual_end !== undefined) {
      updateData.actual_end = data.actual_end ? new Date(data.actual_end) : null;
    }

    if (data.vehicle_id !== undefined) {
      updateData.vehicle = data.vehicle_id ? { connect: { id: data.vehicle_id } } : { disconnect: true };
    }
    if (data.carrier_id !== undefined) {
      updateData.carrier = data.carrier_id ? { connect: { id: data.carrier_id } } : { disconnect: true };
    }
    if (data.operation_id !== undefined) {
      updateData.operation = data.operation_id ? { connect: { id: data.operation_id } } : { disconnect: true };
    }
    if (data.route_id !== undefined) {
      updateData.route = data.route_id ? { connect: { id: data.route_id } } : { disconnect: true };
    }

    if (data.origin_location_id !== undefined) {
      updateData.origin_location = data.origin_location_id ? { connect: { id: data.origin_location_id } } : { disconnect: true };
      if (data.origin_location_id) {
        const loc = await this.prisma.savedLocation.findFirst({
          where: tenantWhere(tenantId, 'TripsService.update.origin', { id: data.origin_location_id })
        });
        if (loc) {
          updateData.origin_name = loc.name;
          updateData.origin_address = loc.address;
          updateData.origin_lat = loc.latitude;
          updateData.origin_lng = loc.longitude;
        }
      } else {
        updateData.origin_name = null;
        updateData.origin_address = null;
        updateData.origin_lat = null;
        updateData.origin_lng = null;
      }
    }

    if (data.destination_location_id !== undefined) {
      updateData.destination_location = data.destination_location_id ? { connect: { id: data.destination_location_id } } : { disconnect: true };
      if (data.destination_location_id) {
        const loc = await this.prisma.savedLocation.findFirst({
          where: tenantWhere(tenantId, 'TripsService.update.destination', { id: data.destination_location_id })
        });
        if (loc) {
          updateData.destination_name = loc.name;
          updateData.destination_address = loc.address;
          updateData.destination_lat = loc.latitude;
          updateData.destination_lng = loc.longitude;
        }
      } else {
        updateData.destination_name = null;
        updateData.destination_address = null;
        updateData.destination_lat = null;
        updateData.destination_lng = null;
      }
    }

    const trip = await this.prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    if (updateData.status === 'FINALIZADO' && trip.vehicle_id) {
      await this.carbonService.dispatchFinalCalculation(trip.id, trip.vehicle_id, trip.tenant_id);
    }

    return this.mapToDto(trip);
  }

  /**
   * Verifica que un estado exista en el catálogo `motor_estados_viaje`.
   *
   * Por qué acá y no en un DTO: el proyecto no tiene DTOs (los controllers
   * reciben `@Body() data: any`), y los tres escritores de `trips.status`
   * pasan por este servicio.
   *
   * Por qué no una FK en la base: `trips.status` la escribe también la Mobile
   * API, que es otro repo — una FK rechazaría su INSERT. La validación cubre
   * el camino del SaaS, que es el que sí controlamos.
   *
   * Qué evita: un estado fuera del catálogo deja el viaje invisible para el
   * motor (que activa el monitoreo con INNER JOIN contra esa tabla) sin emitir
   * ningún error. Es preferible un 400 explícito al escribir que un viaje que
   * nadie monitorea y nadie sabe por qué.
   */
  private async assertEstadoValido(status: string): Promise<void> {
    const filas = await this.prisma.$queryRaw<Array<{ codigo: string }>>`
      SELECT codigo FROM motor_estados_viaje WHERE is_active
    `;
    const validos = filas.map((f) => f.codigo);
    if (!validos.includes(status)) {
      throw new BadRequestException(
        `Estado de viaje desconocido: "${status}". ` +
          `Los válidos son: ${validos.join(', ')}.`,
      );
    }
  }

  /**
   * Borra un viaje — SOLO si no dejó rastro.
   *
   * El `prisma.trip.delete()` a secas que estaba acá devolvía 500 en cualquier
   * viaje real: hacia `trips` apuntan 16 claves foráneas y **seis bloquean**.
   * Postgres levanta 23503, Prisma lo mapea a P2003 y, como el proyecto no
   * tiene ningún ExceptionFilter, subía como error 500 sin explicar nada.
   *
   * Y no era una FK sino una CADENA de seis: quitando la que frena y
   * reintentando aparecen sucesivamente trip_linked_vehicles → trip_events →
   * trip_deviations → trip_risk_history → trip_command_history →
   * trip_attachments. Por eso no alcanza con atrapar el error y nombrar la
   * tabla del mensaje: le mentiría al operador seis veces seguidas.
   *
   * La regla la decide lo que el viaje TIENE, no una política global:
   *
   *  · Viaje en un estado no terminal → 409. Un viaje en curso no se borra:
   *    se finaliza o se cancela.
   *  · Viaje sin nada colgando → se borra de verdad. Es el caso legítimo:
   *    el operador cargó mal un viaje y lo quiere sacar.
   *  · Viaje con historia → 409 enumerando QUÉ lo bloquea, con números, y
   *    señalando la alternativa real (cancelarlo).
   *
   * Por qué NO cascada: `trip_summary`, `trip_sensor_series` y
   * `trip_sensor_excursions` son evidencia probatoria de cadena de frío —
   * sobreviven a propósito a la purga de telemetría, y un cliente puede
   * reclamarlas. Además `trip_attachments` son fotos en Storage: borrar la
   * fila deja el archivo huérfano en el bucket. Y ni siquiera lograría el
   * objetivo: el `TripId` también vive dentro de `telemetry.raw_payload`, que
   * ninguna cascada reescribe.
   */
  async remove(id: string, tenantId: string) {
    await this.assertViajeDelTenant(id, tenantId);

    // `assertViajeDelTenant` sólo confirma la pertenencia (hace `select: {id}`),
    // así que el estado y el código hay que traerlos aparte.
    const viaje = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true, status: true, trip_code: true },
    });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');

    // 1 · Un viaje que no terminó no se borra. Se finaliza o se cancela.
    const terminales = await this.prisma.$queryRaw<Array<{ codigo: string }>>`
      SELECT codigo FROM motor_estados_viaje WHERE es_terminal
    `;
    const esTerminal = terminales.some((t) => t.codigo === viaje.status);
    if (!esTerminal) {
      throw new ConflictException(
        `El viaje está en estado "${viaje.status}" y no se puede eliminar. ` +
          'Finalizalo o cancelalo primero.',
      );
    }

    // 2 · Inventario de lo que cuelga del viaje. Se cuenta TODO de una sola
    //     vez para poder decirlo junto: mostrar un bloqueante por vez obliga
    //     al operador a descubrirlos de a uno.
    const [inventario] = await this.prisma.$queryRaw<
      Array<Record<string, bigint>>
    >`
      SELECT
        (SELECT count(*) FROM trip_events            WHERE trip_id = ${id}::uuid) AS eventos,
        (SELECT count(*) FROM trip_deviations        WHERE trip_id = ${id}::uuid) AS desvios,
        (SELECT count(*) FROM trip_linked_vehicles   WHERE trip_id = ${id}::uuid) AS vehiculos_vinculados,
        (SELECT count(*) FROM trip_command_history   WHERE trip_id = ${id}::uuid) AS comandos,
        (SELECT count(*) FROM trip_risk_history      WHERE trip_id = ${id}::uuid) AS historial_riesgo,
        (SELECT count(*) FROM trip_attachments       WHERE trip_id = ${id}::uuid) AS fotos,
        (SELECT count(*) FROM trip_summary           WHERE trip_id = ${id}::uuid) AS resumenes,
        (SELECT count(*) FROM trip_sensor_series     WHERE trip_id = ${id}::uuid) AS series_de_sensores,
        (SELECT count(*) FROM trip_sensor_excursions WHERE trip_id = ${id}::uuid) AS excursiones,
        (SELECT count(*) FROM trip_conditions        WHERE trip_id = ${id}::uuid) AS condiciones,
        (SELECT count(*) FROM trip_state_history     WHERE trip_id = ${id}::uuid) AS historial_de_estados
    `;

    const bloqueantes = Object.entries(inventario ?? {})
      .filter(([, cantidad]) => Number(cantidad) > 0)
      .map(([nombre, cantidad]) => `${Number(cantidad)} ${nombre.replace(/_/g, ' ')}`);

    if (bloqueantes.length > 0) {
      throw new ConflictException(
        'El viaje no se puede eliminar porque tiene historia asociada: ' +
          `${bloqueantes.join(', ')}. ` +
          'Es evidencia del viaje y se conserva a propósito. ' +
          'Si querés sacarlo de las pantallas operativas, cancelalo: ' +
          'el viaje queda con su historia y deja de figurar como activo.',
      );
    }

    // 3 · Sin historia: se borra de verdad. Queda traza en el log porque es
    //     una operación destructiva, aunque lo destruido sea una fila vacía.
    const borrado = await this.prisma.trip.delete({ where: { id } });
    this.logger.log(
      `Viaje eliminado: ${id} (código ${viaje.trip_code ?? 'sin código'}, ` +
        `estado ${viaje.status}, tenant ${tenantId}) — sin registros asociados.`,
    );
    return borrado;
  }

  async updateStatus(id: string, tenantId: string, data: { status: string, notes?: string }) {
    await this.assertViajeDelTenant(id, tenantId);
    await this.assertEstadoValido(data.status);

    const updateData: any = { status: data.status };
    if (data.status === 'EN_CURSO') {
      updateData.actual_start = new Date();
    } else if (data.status === 'FINALIZADO') {
      updateData.actual_end = new Date();
    }
    if (data.notes) {
      updateData.notes = data.notes;
    }
    const trip = await this.prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    if (data.status === 'FINALIZADO' && trip.vehicle_id) {
      await this.carbonService.dispatchFinalCalculation(trip.id, trip.vehicle_id, trip.tenant_id);
    }

    return this.mapToDto(trip);
  }

  async getLogs(id: string, tenantId: string) {
    await this.assertViajeDelTenant(id, tenantId);
    return this.prisma.eventLog.findMany({
      where: {
        trip_id: id,
        event_type: 'operator_log',
      },
      orderBy: { triggered_at: 'desc' },
      include: {
        acknowledger: {
          select: { full_name: true, email: true }
        }
      }
    });
  }

  async addLog(id: string, text: string, user: any) {
    const trip = await this.prisma.trip.findFirst({
      where: tenantWhere(user?.tenantId, 'TripsService.addLog', { id }),
      select: { tenant_id: true, vehicle_id: true }
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    if (!trip.vehicle_id) throw new BadRequestException('El viaje debe tener un vehículo para agregar notas');

    return this.prisma.eventLog.create({
      data: {
        tenant_id: trip.tenant_id,
        vehicle_id: trip.vehicle_id,
        trip_id: id,
        event_type: 'operator_log',
        severity: 'info',
        status: 'open',
        acknowledged_by: user.id,
        metadata_json: { note: text }
      },
      include: {
        acknowledger: {
          select: { full_name: true, email: true }
        }
      }
    });
  }

  // --- LINKED VEHICLES ---

  async getLinkedVehicles(tripId: string, tenantId: string) {
    await this.assertViajeDelTenant(tripId, tenantId);
    return this.prisma.tripLinkedVehicle.findMany({
      where: { trip_id: tripId },
      include: {
        vehicle: true,
      },
      orderBy: { linked_at: 'asc' }
    });
  }

  async linkVehicle(tripId: string, tenantId: string, vehicleId: string, linkType: string = 'support', notes?: string) {
    // Ambos extremos del enlace deben pertenecer al tenant: si no, se podría
    // enganchar un vehículo ajeno a un viaje propio (o al revés).
    await this.assertViajeDelTenant(tripId, tenantId);
    await assertTenantOwnership(this.prisma.vehicle, vehicleId, tenantId, 'Vehículo');

    const existing = await this.prisma.tripLinkedVehicle.findFirst({
      where: { trip_id: tripId, vehicle_id: vehicleId }
    });

    if (existing) {
      throw new BadRequestException('El vehículo ya está enlazado a este viaje.');
    }

    return this.prisma.tripLinkedVehicle.create({
      data: {
        trip_id: tripId,
        vehicle_id: vehicleId,
        link_type: linkType,
        notes: notes || null
      },
      include: {
        vehicle: true
      }
    });
  }

  async unlinkVehicle(tripId: string, tenantId: string, vehicleId: string) {
    await this.assertViajeDelTenant(tripId, tenantId);
    await this.prisma.tripLinkedVehicle.deleteMany({
      where: {
        trip_id: tripId,
        vehicle_id: vehicleId
      }
    });
    return { success: true };
  }

  // --- DRIVER CONTACT ---

  async contactDriverAttempt(tripId: string, user: any) {
    const trip = await this.prisma.trip.findFirst({
      where: tenantWhere(user?.tenantId, 'TripsService.contactDriverAttempt', { id: tripId }),
      select: { tenant_id: true }
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');

    const event = await this.prisma.tripEvent.create({
      data: {
        trip_id: tripId,
        tenant_id: trip.tenant_id,
        event_type: 'driver_contact_attempt',
        metadata_json: { initiated_by: user.id }
      }
    });

    return { success: true, event };
  }

  async contactDriverResponse(tripId: string, tenantId: string, data: any) {
    const trip = await this.prisma.trip.findFirst({
      where: tenantWhere(tenantId, 'TripsService.contactDriverResponse', { id: tripId }),
      select: { tenant_id: true }
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');

    const event = await this.prisma.tripEvent.create({
      data: {
        trip_id: tripId,
        tenant_id: trip.tenant_id,
        event_type: 'driver_contact_response',
        metadata_json: { response: data.response || 'acknowledged' }
      }
    });

    return { success: true, event };
  }

  async generateMobilePairing(tripId: string, tenantId: string) {
    // NOTA: el código RT-XXXX que genera este método pertenece al debate
    // abierto sobre la identidad canónica del conductor (fuera del alcance de
    // esta tanda). Acá sólo se corrige el aislamiento por tenant.
    const trip = await this.prisma.trip.findFirst({
      where: tenantWhere(tenantId, 'TripsService.generateMobilePairing', { id: tripId }),
      include: {
        vehicle: true,
        driver: true,
      }
    });

    if (!trip) throw new NotFoundException('Viaje no encontrado');

    // Generar un codigo seguro, corto y legible
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RT-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const currentMeta = typeof trip.metadata_json === 'object' && trip.metadata_json !== null ? trip.metadata_json : {};
    
    const updatedMeta = {
      ...currentMeta,
      mobile_service_active: true,
      mobile_pairing_code: code,
    };

    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        metadata_json: updatedMeta
      }
    });

    return {
      success: true,
      code,
      plate: trip.vehicle?.plate || null,
      driverDni: trip.driver?.document || null
    };
  }
}
