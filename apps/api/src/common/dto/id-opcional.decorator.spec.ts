import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActualizarVehiculoDto } from '../../vehicles/dto/actualizar-vehiculo.dto';

/**
 * La Tanda 3 rompió la pantalla de vehículos en producción con
 * `carrier_id must be a UUID`, y la prueba sintética daba 200. Estos son los
 * valores reales que un formulario manda, incluidos los dos que fallaban.
 */
const validar = (obj: any) => {
  const inst = plainToInstance(ActualizarVehiculoDto, obj);
  const errs = validateSync(inst as object, { whitelist: true, forbidNonWhitelisted: true });
  return errs.flatMap((e) => Object.values(e.constraints ?? {}));
};

describe('claves foráneas opcionales · los valores que manda un formulario', () => {
  describe('acepta', () => {
    it.each([
      ['null — "ninguno" tal como lo manda hoy VehiclesPage', null],
      ['"" — "ninguno" como lo manda un <select> sin tocar', ''],
      ['UUID v4', '9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f'],
      ['UUID v1', 'e8b5a4d0-a4a1-11ee-be56-0242ac120002'],
      // 🔴 Éste es el que rompió producción: `@IsUUID('all')` exige que el
      // dígito de versión sea 1-5, y esta base la comparten tres productos.
      ['UUID con dígito de versión fuera de 1-5', '22222222-2222-2222-2222-222222222222'],
      ['UUID en mayúsculas', '9F1C2D3E-4A5B-4C6D-8E7F-0A1B2C3D4E5F'],
      ['UUID todo ceros', '00000000-0000-0000-0000-000000000000'],
    ])('%s', (_n, valor) => {
      expect(validar({ carrier_id: valor })).toEqual([]);
    });

    it('el string vacío se convierte en null antes de llegar al servicio', () => {
      const inst: any = plainToInstance(ActualizarVehiculoDto, { carrier_id: '' });
      // Si llegara como '' a Prisma, la FK reventaría con un 500 evitable.
      expect(inst.carrier_id).toBeNull();
    });
  });

  describe('sigue rechazando la basura', () => {
    it.each([
      ['texto suelto', 'no-soy-un-id'],
      ['número', 12345],
      ['UUID incompleto', '9f1c2d3e-4a5b-4c6d'],
      ['inyección', "' OR 1=1 --"],
    ])('%s', (_n, valor) => {
      expect(validar({ carrier_id: valor }).length).toBeGreaterThan(0);
    });
  });

  it('el cuerpo COMPLETO de VehiclesPage.tsx:198 con el select vacío pasa entero', () => {
    // El caso exacto que Gustavo reportó desde producción.
    expect(validar({
      plate: 'AAA111', alias: 'Camión 1', brand: 'Scania', model: 'R450',
      vehicle_type: 'truck', fuel_type: 'diesel', fuel_efficiency_lper100km: 32.5,
      avl_user_id: '', hub_asset_id: '', dictionary_category: '', carrier_id: '',
      image_front_url: '', image_rear_url: '', image_side_url: '',
    })).toEqual([]);
  });
});
