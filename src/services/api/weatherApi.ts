import { apiGet } from './client'
import type { CurrentWeatherSummary } from './types'

export function getCurrentWeather(city = '武汉') {
  const params = new URLSearchParams({ city })
  return apiGet<CurrentWeatherSummary>(`/weather/current?${params.toString()}`)
}
