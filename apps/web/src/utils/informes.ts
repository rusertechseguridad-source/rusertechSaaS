/**
 * ACCESO AL INFORME DE VIAJE — helper compartido.
 *
 * Vive acá porque lo usan el detalle del viaje Y el listado: quien quiere el
 * informe de cinco viajes no debería entrar a cada uno.
 *
 * El endpoint exige el JWT en el header, así que no alcanza con
 * window.open(url): se descarga con fetch y se abre el blob.
 */

const API = 'http://localhost:3000/api/v1/informes';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` });

export async function abrirInforme(tripId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/viajes/${tripId}`, { headers: headers() });
    if (res.status === 403) return { ok: false, error: 'sin_permiso' };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface EstadoResumen {
  tiene_resumen: boolean;
  trabajo: 'pendiente' | 'procesando' | 'listo' | 'fallido' | null;
  trabajo_error: string | null;
}

export async function estadoResumen(tripId: string): Promise<EstadoResumen | null> {
  try {
    const res = await fetch(`${API}/viajes/${tripId}/estado`, { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function recalcularResumen(tripId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/viajes/${tripId}/recalcular`, { method: 'POST', headers: headers() });
    return res.ok;
  } catch {
    return false;
  }
}
