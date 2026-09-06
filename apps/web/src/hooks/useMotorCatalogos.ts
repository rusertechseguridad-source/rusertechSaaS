import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../services/api';

/**
 * CATÁLOGOS DEL MOTOR.
 *
 * ⚠️ Existe para reemplazar las listas de valores escritas a mano en las
 * pantallas. La de protocolos filtraba por `en_curso` y `critico` mientras la
 * base tenía `in_progress` y `riesgo_critico`: cualquier filtro devolvía cero
 * filas, y nadie se enteraba porque "cero resultados" parece una respuesta
 * válida.
 *
 * Con esto, los valores salen de la misma tabla contra la que se filtra. No
 * pueden desincronizarse.
 */

/** Prefijo de este módulo. La base sale de `services/api`. */
const BASE = `${API_URL}/api/v1/motor/catalogos`;

export interface NivelRiesgo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  color: string;
  sla_minutos: number | null;
  requiere_atencion_operador: boolean;
}

export interface EstadoViaje {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  monitoreable: boolean;
  es_terminal: boolean;
  color: string;
}

export interface TipoCondicion {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  familia: 'seguridad' | 'logistica' | 'operativa';
  riesgo_default: string;
  resolucion: 'automatico' | 'operador';
  detectable_sin_app: boolean;
  requiere_datos_faltantes: boolean;
}

export interface ValorContexto {
  dimension: 'gps_reporting' | 'driver_communication';
  codigo: string;
  nombre: string;
  orden: number;
  umbral_minutos: number | null;
}

export interface CatalogosMotor {
  niveles_riesgo: NivelRiesgo[];
  estados_viaje: EstadoViaje[];
  tipos_condicion: TipoCondicion[];
  valores_contexto: ValorContexto[];
}

const VACIO: CatalogosMotor = {
  niveles_riesgo: [], estados_viaje: [], tipos_condicion: [], valores_contexto: [],
};

/**
 * Los catálogos cambian muy poco: se cachean 5 minutos para no pedirlos en
 * cada pantalla que los necesite.
 */
export const useMotorCatalogos = () =>
  useQuery<CatalogosMotor>({
    queryKey: ['motor-catalogos'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(BASE, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al cargar los catálogos del motor');
      const data = await res.json();
      return { ...VACIO, ...(data ?? {}) };
    },
  });

/** Valores de una dimensión de contexto, ya filtrados y ordenados. */
export function valoresDe(
  catalogos: CatalogosMotor | undefined,
  dimension: ValorContexto['dimension'],
): ValorContexto[] {
  return (catalogos?.valores_contexto ?? [])
    .filter((v) => v.dimension === dimension)
    .sort((a, b) => a.orden - b.orden);
}
