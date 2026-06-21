import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NOTIFICATION_EVENTS = [
  { key: 'alert.critical',      label: 'Alerta Crítica',                   group: 'Alertas' },
  { key: 'alert.warning',       label: 'Alerta de Advertencia',            group: 'Alertas' },
  { key: 'alert.resolved',      label: 'Alerta Resuelta',                  group: 'Alertas' },
  { key: 'trip.started',        label: 'Viaje Iniciado',                   group: 'Viajes' },
  { key: 'trip.ended',          label: 'Viaje Finalizado',                 group: 'Viajes' },
  { key: 'trip.deviation',      label: 'Desviación de Ruta',               group: 'Viajes' },
  { key: 'trip.delayed',        label: 'Viaje Demorado',                   group: 'Viajes' },
  { key: 'report.daily',        label: 'Reporte Diario Automático',        group: 'Reportería' },
  { key: 'report.weekly',       label: 'Reporte Semanal Automático',       group: 'Reportería' },
  { key: 'report.monthly',      label: 'Reporte Mensual Automático',       group: 'Reportería' },
  { key: 'vehicle.expiry',      label: 'Vencimiento de Póliza/Patente/VTV',group: 'Vencimientos' },
  { key: 'driver.expiry',       label: 'Vencimiento de Licencia Conductor',group: 'Vencimientos' },
  { key: 'sensor.threshold',    label: 'Umbral de Sensor Superado',        group: 'Sensores' },
  { key: 'geofence.enter',      label: 'Ingreso a Zona Restringida',       group: 'Geofencing' },
  { key: 'geofence.exit',       label: 'Salida de Zona',                   group: 'Geofencing' },
  { key: 'device.offline',      label: 'Dispositivo Sin Señal',            group: 'Dispositivos' },
  { key: 'device.online',       label: 'Dispositivo Reconectado',          group: 'Dispositivos' },
];

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  getAvailableEvents() {
    return NOTIFICATION_EVENTS;
  }

  async getChannels(tenantId: string) {
    return this.prisma.notificationChannel.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
  }

  async createChannel(tenantId: string, data: {
    name: string;
    channel_type: string;
    target: string;
    events: string[];
    config?: any;
  }) {
    return this.prisma.notificationChannel.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        channel_type: data.channel_type,
        target: data.target,
        events: data.events,
        config: data.config || {},
        is_active: true,
      },
    });
  }

  async updateChannel(tenantId: string, id: string, data: {
    name?: string;
    channel_type?: string;
    target?: string;
    events?: string[];
    config?: any;
    is_active?: boolean;
  }) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado');

    return this.prisma.notificationChannel.update({
      where: { id },
      data: {
        name: data.name,
        channel_type: data.channel_type,
        target: data.target,
        events: data.events,
        config: data.config,
        is_active: data.is_active,
        updated_at: new Date(),
      },
    });
  }

  async deleteChannel(tenantId: string, id: string) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado');

    return this.prisma.notificationChannel.delete({ where: { id } });
  }

  async toggleChannel(tenantId: string, id: string) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado');

    return this.prisma.notificationChannel.update({
      where: { id },
      data: { is_active: !channel.is_active, updated_at: new Date() },
    });
  }
}
