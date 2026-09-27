import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * PREPARACIÓN COMÚN DE LAS PRUEBAS DEL NAVEGADOR.
 *
 * ⚠️ `cleanup()` después de cada prueba. Sin esto, un componente que quedó
 * montado sigue con sus temporizadores y sus suscripciones vivos, y una prueba
 * que falla deja colgado al corredor entero. Ya pasó en el backend con el
 * latido de la campana: la suite se quedaba esperando 25 segundos por cada
 * prueba caída.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * ⚠️ jsdom NO TRAE `AudioContext`. El servicio de sonido lo crea de forma
 * perezosa —recién cuando hay un gesto del usuario— así que montar la campana
 * no lo toca; pero si alguna prueba activa el sonido, sin esto explota con un
 * error que no tiene nada que ver con lo que se está probando.
 *
 * Es un doble mínimo a propósito: lo justo para que no rompa. Probar que
 * suena de verdad necesita un navegador, y eso está dicho en el reporte.
 */
class ContextoDeAudioFalso {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {} },
      connect() {}, start() {}, stop() {},
      addEventListener() {}, removeEventListener() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
}
(globalThis as unknown as { AudioContext: unknown }).AudioContext = ContextoDeAudioFalso;

/** El token que leen los stores. Sin esto, `cabeceras()` manda `Bearer null`. */
globalThis.localStorage?.setItem('rusertech_token', 'token-de-prueba');
