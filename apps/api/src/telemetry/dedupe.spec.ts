import { claveDedupe } from './dedupe';

/**
 * La invariante que prueban estos tests es la que se rompió en producción: dos
 * puntos del MISMO vehículo en el MISMO segundo con DISTINTO código son puntos
 * distintos, y deben sobrevivir los dos.
 */
describe('claveDedupe', () => {
  const vehiculo = '11111111-1111-1111-1111-111111111111';
  const otroVehiculo = '22222222-2222-2222-2222-222222222222';
  const instante = new Date('2026-08-26T14:30:00.000Z');

  describe('lo que debe considerar DISTINTO', () => {
    it('separa una posición de un evento en el mismo segundo — el bug que se corrigió', () => {
      // El AVL manda el evento con el mismo fix de GPS que el reporte
      // periódico. Antes ambos colapsaban en la misma clave y el segundo se
      // descartaba entero: sin fila, sin outbox, sin motor de eventos.
      const posicion = claveDedupe(vehiculo, instante, null);
      const evento = claveDedupe(vehiculo, instante, '03');
      expect(posicion).not.toEqual(evento);
    });

    it('separa dos eventos distintos en el mismo segundo', () => {
      expect(claveDedupe(vehiculo, instante, '01')).not.toEqual(
        claveDedupe(vehiculo, instante, '02'),
      );
    });

    it('separa el mismo evento en vehículos distintos', () => {
      expect(claveDedupe(vehiculo, instante, '01')).not.toEqual(
        claveDedupe(otroVehiculo, instante, '01'),
      );
    });

    it('separa el mismo evento en instantes distintos', () => {
      const unSegundoDespues = new Date(instante.getTime() + 1000);
      expect(claveDedupe(vehiculo, instante, '01')).not.toEqual(
        claveDedupe(vehiculo, unSegundoDespues, '01'),
      );
    });
  });

  describe('lo que debe considerar IGUAL', () => {
    it('colapsa la reentrega exacta del mismo punto — la razón de ser del dedupe', () => {
      expect(claveDedupe(vehiculo, instante, '01')).toEqual(
        claveDedupe(vehiculo, new Date(instante.getTime()), '01'),
      );
    });

    it('trata null y undefined igual: ambos son "sin código"', () => {
      // Importa porque `payload.Code || null` puede dar cualquiera de los dos
      // según el proveedor, y una reentrega no debe escaparse por esa
      // diferencia. Es el equivalente en memoria del NULLS NOT DISTINCT del
      // índice telemetry_hub_dedupe.
      expect(claveDedupe(vehiculo, instante, null)).toEqual(
        claveDedupe(vehiculo, instante, undefined),
      );
    });
  });

  it('usa milisegundos, no la representación local de la fecha', () => {
    // Dos Date construidos distinto pero del mismo instante tienen que dar la
    // misma clave: el proveedor puede mandar la fecha con o sin offset.
    const conOffset = new Date('2026-08-26T11:30:00.000-03:00');
    expect(claveDedupe(vehiculo, conOffset, '01')).toEqual(
      claveDedupe(vehiculo, instante, '01'),
    );
  });
});
