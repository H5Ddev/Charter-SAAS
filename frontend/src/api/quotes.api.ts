import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface QuoteLineItemInput {
  description: string
  quantity: number
  unitPrice: number
  category?: string
}

export interface CreateQuoteInput {
  contactId: string
  tripId?: string
  originIcao?: string
  destinationIcao?: string
  tripType?: 'ONE_WAY' | 'ROUND_TRIP'
  departureDate?: string
  returnDate?: string
  validUntil?: string
  basePrice: number
  currency: string
  notes?: string
  lineItems: QuoteLineItemInput[]
}

const QUOTES_KEY = 'quotes'

export function useCreateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateQuoteInput) => {
      const response = await apiClient.post<{ id: string; reference: string }>('/quotes', data)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUOTES_KEY] })
    },
  })
}
