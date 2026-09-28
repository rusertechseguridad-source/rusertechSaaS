import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { UbicacionDelAviso, enlaceAlMapa } from './UbicacionDelAviso';
import { AvisoCritico } from './AvisoCritico';
import { PanelCampana } from './PanelCampana';
import { ModalAtencion } from './ModalAtencion';
import { useBitacoraStore } from '../../store/bitacoraStore';
import type { Aviso } from '../../store/campanaStore';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL «DÓNDE» DEL AVISO — los tres casos y los tres lugares
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El aviso decía «sin ubicación en el aviso» para toda condición del motor.
 * En custodia, dónde está el camión es la mitad de la información.
 *
 * ⚠️ LO QUE ESTAS PRUEBAS NO VEN: si el bloque ENTRA en la pantalla y si
 * empuja los botones fuera de la vista. jsdom no tiene motor de disposición.
 * Eso está en `pruebas-navegador/campana.visible.spec.ts`, en dos tamaños.
 *
 * Las horas: vitest corre con `TZ=America/Argentina/Buenos_Aires`.
 *   posición 03:10 UTC → 00:10 · alerta 09:00 UTC → 06:00
 */
const BASE: Aviso = {
  fuente: 'condicion',
  id: 'cccc0001-0000-4000-8000-000000000001',
  tenant_id: '11111111-1111-1111-1111-111111111111',
  vehicle_id: 'aaaa0001-0000-4000-8000-000000000001',
  trip_id: null,
  tipo: 'SIN_REPORTE',
  titulo: 'Sin reporte',
  nivel_riesgo: 'riesgo_critico',
  color: '#c0202e',
  interrumpe: true,
  requiere_atencion: true,
  clasificado: true,
  ocurrio_at: '2026-09-28T09:00:00.000Z',
  patente: 'DEMO-001',
  latitud: -34.60372,
  longitud: -58.38159,
  ubicacion_at: '2026-09-28T03:10:00.000Z',
  lugar: null,
  direccion: null,
  disparador: '50 minutos sin reportar',
};

const CON_NOMBRE: Aviso = { ...BASE, lugar: 'Depósito Norte' };
const CON_COORDENADAS: Aviso = { ...BASE };
const SIN_POSICION: Aviso = { ...BASE, latitud: null, longitud: null, ubicacion_at: null };

const bloque = () => screen.getByRole('group', { name: 'Dónde estaba' });

describe('Ubicación · los tres casos', () => {
  it('🔴 dentro de un lugar guardado: muestra el NOMBRE', () => {
    render(<UbicacionDelAviso aviso={CON_NOMBRE} />);
    expect(within(bloque()).getByText('Depósito Norte')).toBeInTheDocument();
    // El nombre manda: las coordenadas crudas no compiten con él.
    expect(within(bloque()).queryByText(/-34\.60372/)).not.toBeInTheDocument();
  });

  it('🔴 fuera de todo lugar: muestra las COORDENADAS y el enlace al mapa', () => {
    render(<UbicacionDelAviso aviso={CON_COORDENADAS} />);
    expect(within(bloque()).getByText('-34.60372, -58.38159')).toBeInTheDocument();

    const enlace = within(bloque()).getByRole('link', { name: /Abrir en Google Maps/i });
    expect(enlace).toHaveAttribute('href', 'https://www.google.com/maps?q=-34.603720,-58.381590');
    // En otra pestaña: el operador no pierde la alerta de vista.
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('🔴 sin posición: LO DICE, no deja un hueco', () => {
    // Es el caso normal hoy en producción: medido, 1 fila en
    // motor_estado_vehiculo y 0 con posición.
    render(<UbicacionDelAviso aviso={SIN_POSICION} />);
    expect(within(bloque()).getByText(/Sin posición/)).toBeInTheDocument();
    // Y sin un enlace a ninguna parte.
    expect(within(bloque()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('🔴 la hora es la de la POSICIÓN, no la de la alerta', () => {
    // Un camión callado hace seis horas tiene una posición de hace seis
    // horas. Si esto mostrara la hora de la alerta, un punto viejo se leería
    // como reciente.
    render(<UbicacionDelAviso aviso={CON_NOMBRE} />);
    const texto = bloque().textContent ?? '';
    expect(texto).toMatch(/00:10/);
    expect(texto).not.toMatch(/06:00/);
  });

  it('el enlace usa latitud y longitud en ese orden', () => {
    // Invertirlas no rompe nada visible: manda al operador a otro lugar del mundo.
    expect(enlaceAlMapa(-34.6, -58.4)).toBe('https://www.google.com/maps?q=-34.600000,-58.400000');
  });
});

describe('Ubicación · aparece en los TRES lugares, con el mismo bloque', () => {
  beforeEach(() => {
    useBitacoraStore.setState({
      abierta: null, protocolo: null, hilo: [],
      cargando: false, guardando: false, error: null,
    });
  });

  it('🔴 en el aviso crítico', () => {
    render(
      <AvisoCritico
        aviso={CON_NOMBRE}
        sonidoActivo
        onAtender={() => {}}
        onActivarSonido={() => {}}
        onMinimizar={() => {}}
      />,
    );
    const aviso = screen.getByRole('alertdialog');
    expect(within(aviso).getByRole('group', { name: 'Dónde estaba' })).toHaveTextContent('Depósito Norte');
    // El texto viejo no vuelve.
    expect(within(aviso).queryByText(/sin ubicación en el aviso/i)).not.toBeInTheDocument();
  });

  it('🔴 en la lista de la campana', () => {
    render(
      <PanelCampana
        avisos={[CON_NOMBRE]}
        conexion="en_vivo"
        cargando={false}
        error={null}
        sonidoActivo
        silenciado={false}
        onAtender={() => {}}
        onAlternarSilencio={() => {}}
        onActivarSonido={() => {}}
      />,
    );
    const lista = screen.getByRole('region', { name: 'Alertas sin atender' });
    expect(within(lista).getByRole('group', { name: 'Dónde estaba' })).toHaveTextContent('Depósito Norte');
  });

  it('🔴 en la ventana de la bitácora', () => {
    useBitacoraStore.setState({ abierta: CON_NOMBRE, cargando: true });
    render(<ModalAtencion />);
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('group', { name: 'Dónde estaba' })).toHaveTextContent('Depósito Norte');
  });

  it('🔴 y sin posición, los tres lo dicen igual', () => {
    useBitacoraStore.setState({ abierta: SIN_POSICION, cargando: true });
    render(
      <>
        <AvisoCritico aviso={SIN_POSICION} sonidoActivo onAtender={() => {}}
          onActivarSonido={() => {}} onMinimizar={() => {}} />
        <PanelCampana avisos={[SIN_POSICION]} conexion="en_vivo" cargando={false} error={null}
          sonidoActivo silenciado={false} onAtender={() => {}}
          onAlternarSilencio={() => {}} onActivarSonido={() => {}} />
        <ModalAtencion />
      </>,
    );
    const textos = screen.getAllByRole('group', { name: 'Dónde estaba' }).map((b) => b.textContent);
    expect(textos).toHaveLength(3);
    // Un formato: el mismo texto en los tres.
    expect(new Set(textos).size).toBe(1);
    expect(textos[0]).toMatch(/Sin posición/);
  });
});
