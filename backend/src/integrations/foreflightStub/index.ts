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
 * TODO STUB: ForeFlight Integration
 *
 * ForeFlight is an aviation planning application. To implement this integration:
 *
 * 1. Join the ForeFlight Developer Program:
 *    https://developer.foreflight.com/
 *
 * 2. Obtain credentials:
 *    - FOREFLIGHT_API_KEY: API key from your developer account
 *    - FOREFLIGHT_BASE_URL: https://plan.foreflight.com/api
 *
 * 3. Key capabilities to implement:
 *    - Flight plan filing via POST /v1/flightplans
 *    - Airport information via GET /v1/airports/{icao}
 *    - Weather briefings via GET /v1/weather/briefing
 *    - NOTAMs via GET /v1/notams
 *    - TFRs (Temporary Flight Restrictions) via GET /v1/tfrs
 *
 * 4. Authentication:
 *    ForeFlight uses API key authentication. Include the key in the
 *    Authorization header: Bearer {FOREFLIGHT_API_KEY}
 *
 * 5. Rate limiting:
 *    ForeFlight enforces rate limits. Implement retry logic with exponential backoff.
 */

export interface FlightPlan {
  origin: string
  destination: string
  departureTime: Date
  aircraftId: string
  route?: string
  altitude?: number
  speed?: number
  remarks?: string
}

export interface AirportInfo {
  icao: string
  name: string
  city: string
  country: string
  elevation?: number
  runways?: Array<{ heading: number; length: number; surface: string }>
  frequencies?: Array<{ type: string; frequency: string }>
  fbo?: Array<{ name: string; phone: string; address: string }>
}

export interface WeatherBriefing {
  icao: string
  metar?: string
  taf?: string
  pireps?: string[]
  airmets?: string[]
  sigmets?: string[]
  retrievedAt: Date
}

export class ForeFightStubIntegration implements Integration {
  name = 'foreflight'
  private config: Record<string, string> | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(_config: Record<string, string>): Promise<void> {
    throw new Error(
      'ForeFlight integration is not yet implemented. ' +
      'To implement this integration, join the ForeFlight Developer Program at ' +
      'https://developer.foreflight.com/ and set FOREFLIGHT_API_KEY in your environment.',
    )
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  async sendMessage(_payload: MessagePayload): Promise<MessageResult> {
    throw new Error('ForeFlight integration does not support sending messages.')
  }

  verifySignature(_req: Request): boolean {
    return true
  }

  async receiveWebhook(_req: Request): Promise<WebhookEvent> {
    return {
      eventId: uuidv4(),
      eventType: 'FOREFLIGHT_STUB',
      payload: {},
      rawBody: {},
      receivedAt: new Date(),
    }
  }

  /**
   * TODO STUB: File a flight plan with ForeFlight.
   */
  async getFlightPlan(_tripId: string): Promise<FlightPlan | null> {
    logger.warn('ForeFlight.getFlightPlan called but integration is not implemented')
    if (process.env.NODE_ENV === 'development') {
      // Return mock data in development
      return {
        origin: 'KTEB',
        destination: 'KBOS',
        departureTime: new Date(),
        aircraftId: 'N737SC',
        route: 'JUDDS V3 DAFOE',
        altitude: 25000,
        speed: 450,
      }
    }
    throw new Error('ForeFlight integration not implemented')
  }

  /**
   * TODO STUB: Get airport information.
   */
  async getAirportInfo(icao: string): Promise<AirportInfo> {
    logger.warn(`ForeFlight.getAirportInfo(${icao}) called but integration is not implemented`)
    if (process.env.NODE_ENV === 'development') {
      return {
        icao,
        name: `${icao} Airport (Mock)`,
        city: 'Mock City',
        country: 'US',
        elevation: 100,
      }
    }
    throw new Error('ForeFlight integration not implemented')
  }

  /**
   * TODO STUB: Get weather briefing for an airport.
   */
  async getWeatherBriefing(icao: string): Promise<WeatherBriefing> {
    logger.warn(`ForeFlight.getWeatherBriefing(${icao}) called but integration is not implemented`)
    if (process.env.NODE_ENV === 'development') {
      return {
        icao,
        metar: `${icao} 201855Z 22015KT 10SM FEW035 25/12 A2992`,
        taf: `${icao} 201730Z 2018/2118 22015KT 9999 FEW035`,
        retrievedAt: new Date(),
      }
    }
    throw new Error('ForeFlight integration not implemented')
  }
}
