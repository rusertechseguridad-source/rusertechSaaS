import { codificarPolyline, simplificarParaUrl } from './polyline';

describe('codificarPolyline', () => {
  it('reproduce el vector de prueba oficial del algoritmo', () => {
    expect(
      codificarPolyline([
        [38.5, -120.2],
        [40.7, -120.95],
        [43.252, -126.453],
      ]),
    ).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('codifica un solo punto', () => {
    expect(codificarPolyline([[38.5, -120.2]])).toBe('_p~iF~ps|U');
  });

  it('lista vacía produce cadena vacía', () => {
    expect(codificarPolyline([])).toBe('');
  });
});

describe('simplificarParaUrl', () => {
  it('no toca una lista corta', () => {
    const c: [number, number][] = [[1, 1], [2, 2]];
    expect(simplificarParaUrl(c, 300)).toEqual(c);
  });

  it('reduce conservando el primero y el último', () => {
    const c: [number, number][] = Array.from({ length: 1000 }, (_, i) => [i, i]);
    const r = simplificarParaUrl(c, 300);
    expect(r).toHaveLength(300);
    expect(r[0]).toEqual([0, 0]);
    expect(r[r.length - 1]).toEqual([999, 999]);
  });
});
