import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface CreateTicketInput {
  title: string
  body?: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  contactId?: string
  tripId?: string
  quoteId?: string
  source?: string
  assignedTo?: string
}

const TICKETS_KEY = 'tickets'

export function useCreateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTicketInput) => {
      const response = await apiClient.post<{ id: string; reference: string }>('/tickets', data)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] })
    },
  })
}
