/**
 * Tipos del monitor de ingesta AVL.
 * Espejo de `apps/api/src/avl-users/avl-monitor.service.ts`.
 */

/** Estado de un proveedor, derivado de la antigüedad de su último dato. */
export type EstadoIngesta = 'en_vivo' | 'inactivo' | 'sin_senal' | 'sin_datos' | 'inactivo_config';

export interface CodigoIngesta {
  provider_code: string;
  cantidad: number;
  ultimo: string;
  /** Si el diccionario del proveedor tiene una entrada activa para el código. */
  reconocido: boolean;
  /** Si el código llegó desde la app del conductor. */
  origen_movil: boolean;
}

export interface ResumenAvlUser {
  id: string;
  user_avl_code: string;
  name: string;
  provider_name: string | null;
  is_active: boolean;
  ultimo_punto: string | null;
  age_seconds: number | null;
  estado: EstadoIngesta;
  puntos: number;
  puntos_movil: number;
  duplicados: number;
  vehiculos_reportando: number;
  vehiculos_asignados: number;
  codigos: CodigoIngesta[];
  codigos_desconocidos: number;
}

export interface RespuestaMonitorAvl {
  ventana_horas: number;
  desde: string;
  hasta: string;
  umbral_en_vivo_minutos: number;
  umbral_inactivo_minutos: number;
  proveedores: ResumenAvlUser[];
}

export interface VehiculoIngesta {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  status: string | null;
  puntos: number;
  ultimo_punto: string | null;
  age_seconds: number | null;
  estado: EstadoIngesta;
}

export interface RespuestaVehiculosAvl {
  ventana_horas: number;
  vehiculos: VehiculoIngesta[];
}

/** Opciones de ventana. El techo de 168 h lo impone el particionado mensual. */
export const VENTANAS_HORAS = [1, 6, 24, 72, 168] as const;
