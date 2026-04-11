import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface PortalContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export interface PortalTenant {
  id: string
  name: string
}

export interface PortalOtpHint {
  method: 'sms' | 'email'
  hint: string
}

export interface PortalLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  category: string | null
}

export interface PortalQuote {
  id: string
  reference: string
  status: string
  originIcao: string | null
  destinationIcao: string | null
  tripType: string | null
  departureDate: string | null
  returnDate: string | null
  basePrice: number
  totalPrice: number
  currency: string
  validUntil: string | null
  notes: string | null
  createdAt: string
  lineItems: PortalLineItem[]
}

export interface PortalTrip {
  id: string
  reference: string
  status: string
  originIcao: string
  destinationIcao: string
  departureAt: string
  arrivalAt: string | null
  returnTrip: {
    id: string
    departureAt: string
    arrivalAt: string | null
    originIcao: string
    destinationIcao: string
  } | null
  boardingTime: string | null
  fboName: string | null
  fboAddress: string | null
  paxCount: number
  isDelayed: boolean
  delayNotes: string | null
  notes: string | null
  aircraft: { tailNumber: string; make: string; model: string } | null
}

// Admin: generate a portal link for a contact
export function useGeneratePortalLink() {
  return useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiClient.post<{ url: string; token: string; contact: PortalContact }>(
        '/portal/link',
        { contactId },
      )
      return res.data
    },
  })
}

// Public portal hooks (no auth — token in URL)
const portalBase = (token: string) => `/portal/${token}`

export function usePortalIdentity(token: string) {
  return useQuery({
    queryKey: ['portal', token, 'identity'],
    queryFn: async () => {
      const res = await apiClient.get<{
        contact: PortalContact
        tenant: PortalTenant
        otpHint: PortalOtpHint
      }>(portalBase(token))
      return res.data
    },
    retry: false,
  })
}

export function usePortalQuotes(token: string) {
  return useQuery({
    queryKey: ['portal', token, 'quotes'],
    queryFn: async () => {
      const res = await apiClient.get<PortalQuote[]>(`${portalBase(token)}/quotes`)
      return res.data
    },
    enabled: !!token,
  })
}

export function usePortalTrips(token: string) {
  return useQuery({
    queryKey: ['portal', token, 'trips'],
    queryFn: async () => {
      const res = await apiClient.get<PortalTrip[]>(`${portalBase(token)}/trips`)
      return res.data
    },
    enabled: !!token,
  })
}

// OTP flow
export function useSendPortalOtp(token: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ challengeToken: string }>(
        `${portalBase(token)}/otp/send`,
      )
      return res.data
    },
  })
}

export function useVerifyPortalOtp(token: string) {
  return useMutation({
    mutationFn: async ({ challengeToken, code }: { challengeToken: string; code: string }) => {
      const res = await apiClient.post<{ sessionToken: string }>(
        `${portalBase(token)}/otp/verify`,
        { challengeToken, code },
      )
      return res.data
    },
  })
}

// Protected actions — require sessionToken passed as X-Portal-Session header

export function useRespondToQuote(token: string, sessionToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      quoteId,
      response,
      notes,
    }: {
      quoteId: string
      response: 'ACCEPTED' | 'DECLINED'
      notes?: string
    }) => {
      const res = await apiClient.patch<PortalQuote>(
        `${portalBase(token)}/quotes/${quoteId}/respond`,
        { response, notes },
        { headers: { 'X-Portal-Session': sessionToken } },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal', token, 'quotes'] })
    },
  })
}

export function useSubmitPortalRequest(token: string, sessionToken: string) {
  return useMutation({
    mutationFn: async (data: {
      requestType: 'NEW_QUOTE' | 'TRIP_CHANGE' | 'GENERAL'
      title: string
      message: string
    }) => {
      const res = await apiClient.post(
        `${portalBase(token)}/requests`,
        data,
        { headers: { 'X-Portal-Session': sessionToken } },
      )
      return res.data
    },
  })
}
