import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type { WeatherIconCode, WeatherResponseDto } from './dto/weather.dto';

// ─── WMO Weather Code → (iconCode, description) ──────────────────────────────

interface WeatherMeta {
  iconCode: WeatherIconCode;
  description: string;
}

function mapWmoCode(code: number): WeatherMeta {
  if (code === 0) return { iconCode: 'sunny', description: 'Trời đẹp' };
  if (code <= 3) return { iconCode: 'cloudy', description: 'Có mây' };
  if (code === 45 || code === 48) return { iconCode: 'foggy', description: 'Sương mù' };
  if (code >= 51 && code <= 67) return { iconCode: 'rainy', description: 'Có mưa' };
  if (code >= 71 && code <= 77) return { iconCode: 'cloudy', description: 'Có mây dày' };
  if (code >= 80 && code <= 82) return { iconCode: 'rainy', description: 'Mưa rào' };
  if (code >= 85 && code <= 86) return { iconCode: 'rainy', description: 'Mưa tuyết' };
  if (code >= 95 && code <= 99) return { iconCode: 'stormy', description: 'Giông bão' };
  return { iconCode: 'unknown', description: 'Không xác định' };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: WeatherResponseDto;
  expiresAt: number; // ms timestamp
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút
  private readonly OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

  constructor(private readonly http: HttpService) {}

  async getWeather(lat: number, lon: number): Promise<WeatherResponseDto> {
    // Làm tròn 2 chữ số thập phân để cache hiệu quả hơn
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const cacheKey = `${roundedLat},${roundedLon}`;

    // Kiểm tra cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      this.logger.debug(`Weather cache hit: ${cacheKey}`);
      return cached.data;
    }

    // Gọi Open-Meteo
    try {
      const url =
        `${this.OPEN_METEO_URL}` +
        `?latitude=${roundedLat}` +
        `&longitude=${roundedLon}` +
        `&current=temperature_2m,weather_code` +
        `&timezone=Asia%2FHo_Chi_Minh`;

      this.logger.debug(`Fetching weather: ${url}`);

      const response = await firstValueFrom(
        this.http.get<{
          current: {
            temperature_2m: number;
            weather_code: number;
          };
        }>(url, { timeout: 5000 }),
      );

      const { temperature_2m, weather_code } = response.data.current;
      const { iconCode, description } = mapWmoCode(weather_code);

      const result: WeatherResponseDto = {
        tempC: Math.round(temperature_2m),
        description,
        iconCode,
      };

      // Lưu cache
      this.cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      return result;
    } catch (error) {
      this.logger.warn(`Open-Meteo fetch failed for ${cacheKey}: ${error}`);
      // Trả fallback thay vì throw để không crash widget
      return { tempC: 0, description: 'Không có dữ liệu', iconCode: 'unknown' };
    }
  }
}
