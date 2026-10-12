// 현재 날씨 — Open-Meteo (API 키 불필요). 위치를 못 받으면 서울 기준.

const SEOUL = { lat: 37.5665, lon: 126.978 };

export interface WeatherInfo {
  locationLabel: string;
  description: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  precipitationProbability: number;
  humidity: number;
  windSpeed: number; // km/h
}

// WMO weather code → 한국어
function describe(code: number): string {
  if (code === 0) return '맑음';
  if (code <= 2) return '구름 조금';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (code >= 51 && code <= 57) return '이슬비';
  if (code >= 61 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code === 85 || code === 86) return '눈보라';
  if (code >= 95) return '뇌우';
  return '알 수 없음';
}

function validCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

export async function getCurrentWeather(lat?: unknown, lon?: unknown): Promise<WeatherInfo> {
  const useGiven = validCoord(lat, lon);
  const at = useGiven ? { lat: lat as number, lon: lon as number } : SEOUL;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: at.lat.toFixed(4),
    longitude: at.lon.toFixed(4),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  }).toString();

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = (await res.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
  };

  return {
    locationLabel: useGiven ? '현재 위치' : '서울',
    description: describe(j.current.weather_code),
    temperature: j.current.temperature_2m,
    feelsLike: j.current.apparent_temperature,
    tempMin: j.daily.temperature_2m_min[0],
    tempMax: j.daily.temperature_2m_max[0],
    precipitationProbability: j.daily.precipitation_probability_max[0] ?? 0,
    humidity: j.current.relative_humidity_2m,
    windSpeed: j.current.wind_speed_10m,
  };
}

export function weatherToPrompt(w: WeatherInfo): string {
  return (
    `${w.locationLabel} 날씨: ${w.description}, 현재 ${w.temperature}°C (체감 ${w.feelsLike}°C), ` +
    `오늘 최저 ${w.tempMin}°C / 최고 ${w.tempMax}°C, 강수확률 ${w.precipitationProbability}%, ` +
    `습도 ${w.humidity}%, 바람 ${w.windSpeed}km/h`
  );
}
