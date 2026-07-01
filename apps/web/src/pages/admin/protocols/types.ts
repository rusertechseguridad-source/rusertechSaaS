export interface ProtocolStep {
  title: string;
  description: string;
}

export interface OperationalProtocol {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  trip_status: string;
  sub_status: string;
  gps_reporting: string;
  driver_communication: string;
  risk_level: string;
  protocol_steps: ProtocolStep[];
  sla_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export type CreateProtocolDTO = Omit<OperationalProtocol, 'id' | 'tenant_id' | 'created_at'>;
export type UpdateProtocolDTO = Partial<CreateProtocolDTO>;
