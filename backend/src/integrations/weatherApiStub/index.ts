import type { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  Integration,
  IntegrationStatus,
  MessagePayload,
  MessageResult,
  WebhookEvent,
} from '../types'
import { logger } from '../../shared/utils/logger'

/**
 * TODO STUB: Weather API Integration
 *
 * Options for implementation:
 *
 * 1. National Weather Service (free, US-only):
 *    Base URL: https://api.weather.gov
 *    No API key required.
 *    - GET /points/{lat},{lon} → gridpoint
 *    - GET /gridpoints/{office}/{x},{y}/forecast
 *    - GET /stations/{stationId}/observations/latest (METAR equivalent)
 *
 * 2. Tomorrow.io (commercial, global):
 *    Obtain key: https://www.tomorrow.io/
 *    - Real-time, minutely, hourly, daily forecasts
 *    - Aviation-specific endpoints
 *    Set WEATHER_API_KEY in environment.
 *
 * 3. OpenWeatherMap (commercial, global):
 *    Obtain key: https://openweathermap.org/api
 *    Set WEATHER_API_KEY in environment.
 *
 * 4. CheckWX (aviation-specific METAR/TAF):
 *    https://www.checkwxapi.com/
 *    Set WEATHER_API_KEY in environment.
 */

export interface WeatherData {
  icao: string
  date: Date
  temperature?: number
  windSpeed?: number
  windDirection?: number
  visibility?: number
  ceiling?: number
  conditions?: string
  metar?: string
  taf?: string
  retrievedAt: Date
}

const MOCK_WEATHER: WeatherData = {
  icao: 'KTEB',
  date: new Date(),
  temperature: 22,
  windSpeed: 12,
  windDirection: 220,
  visibility: 10,
  ceiling: 3500,
  conditions: 'FEW',
  metar: 'KTEB 201855Z 22012KT 10SM FEW035 22/10 A2993',
  taf: 'KTEB 201730Z 2018/2118 22012KT 9999 FEW035 TEMPO 2022/2024 VRB15G25KT 6000 TSRA SCT030CB',
  retrievedAt: new Date(),
}

export class WeatherApiStubIntegration implements Integration {
  name = 'weather_api'
  private config: Record<string, string> | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = config
    this.status = 'connected'
    logger.warn('Weather API integration is using stub data. Implement a real provider.')
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  async sendMessage(_payload: MessagePayload): Promise<MessageResult> {
    throw new Error('Weather API integration does not support sending messages.')
  }

  verifySignature(_req: Request): boolean {
    return true
  }

  async receiveWebhook(_req: Request): Promise<WebhookEvent> {
    return {
      eventId: uuidv4(),
      eventType: 'WEATHER_API_STUB',
      payload: {},
      rawBody: {},
      receivedAt: new Date(),
    }
  }

  /**
   * TODO STUB: Get weather for an ICAO airport code on a given date.
   * Returns mock data in development.
   */
  async getWeatherForIcao(icao: string, date: Date): Promise<WeatherData> {
    logger.warn(`WeatherApi.getWeatherForIcao(${icao}) called — returning mock data`)

    if (process.env.NODE_ENV === 'development') {
      return { ...MOCK_WEATHER, icao, date }
    }

    // TODO: Implement real API call
    // Example for CheckWX:
    // const response = await fetch(
    //   `https://api.checkwx.com/metar/${icao}/decoded`,
    //   { headers: { 'X-API-Key': this.config?.apiKey ?? '' } }
    // )
    // const data = await response.json()
    // return normaliseWeatherData(data)

    throw new Error('Weather API integration not implemented. Configure WEATHER_API_KEY and implement the provider.')
  }

  /**
   * TODO STUB: Get current METAR for an ICAO airport.
   * Returns mock data in development.
   */
  async getMetar(icao: string): Promise<string> {
    logger.warn(`WeatherApi.getMetar(${icao}) called — returning mock data`)

    if (process.env.NODE_ENV === 'development') {
      return `${icao} ${new Date().toISOString().slice(2, 10).replace(/-/g, '')}00Z 22012KT 10SM FEW035 22/10 A2993`
    }

    throw new Error('Weather API integration not implemented.')
  }
}
