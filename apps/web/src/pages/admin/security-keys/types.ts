export interface SecurityKey {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export type CreateSecurityKeyDTO = Omit<SecurityKey, 'id' | 'tenant_id' | 'created_at'>;
export type UpdateSecurityKeyDTO = Partial<CreateSecurityKeyDTO>;
