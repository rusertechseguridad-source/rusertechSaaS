import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly redis: RedisService) {}

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const latRounded = lat.toFixed(4);
    const lngRounded = lng.toFixed(4);
    const cacheKey = `geocode:${latRounded}:${lngRounded}`;

    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return cached;

    let address: string | null = null;
    
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=es`, {
        signal: AbortSignal.timeout(2000)
      });
      if (!res.ok) throw new Error('Photon returned ' + res.status);
      const data = await res.json();
      if (data?.features?.length > 0) {
        const props = data.features[0].properties;
        const parts = [props.name, props.street, props.city, props.state].filter(Boolean);
        if (parts.length > 0) address = parts.join(', ');
      }
    } catch (e: any) {
      this.logger.warn(`Photon failed for ${lat},${lng}, falling back to Nominatim: ${e.message}`);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`, {
          headers: { 'User-Agent': 'Rusertech/1.0 (contacto@rusertech.com)' },
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.display_name) {
            address = data.display_name;
          }
        }
      } catch (err) {
        this.logger.error('Both Geocoding APIs failed', err);
      }
    }

    if (address) {
      await this.redis.set(cacheKey, address, 86400); // 24h
      return address;
    }

    return null;
  }
}
