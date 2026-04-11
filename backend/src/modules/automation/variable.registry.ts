export interface TemplateVariable {
  path: string
  name: string
  type: 'STRING' | 'DATE' | 'DATETIME' | 'PHONE' | 'URL' | 'NUMBER' | 'BOOLEAN'
  description: string
  example: string
  group: string
}

/**
 * Registry of all available template variables.
 * Used by the frontend VariablePicker for autocomplete.
 * Paths match the execution context structure built by AutomationEngine.buildContext().
 */
export const VARIABLE_REGISTRY: TemplateVariable[] = [
  // Contact variables
  { path: 'contact.firstName', name: 'First Name', type: 'STRING', description: "Contact's first name", example: 'John', group: 'Contact' },
  { path: 'contact.lastName', name: 'Last Name', type: 'STRING', description: "Contact's last name", example: 'Smith', group: 'Contact' },
  { path: 'contact.email', name: 'Email', type: 'STRING', description: "Contact's email address", example: 'john@example.com', group: 'Contact' },
  { path: 'contact.phone', name: 'Phone', type: 'PHONE', description: "Contact's phone number", example: '+15551234567', group: 'Contact' },
  { path: 'contact.whatsappPhone', name: 'WhatsApp Phone', type: 'PHONE', description: "Contact's WhatsApp number", example: '+15551234567', group: 'Contact' },
  { path: 'contact.preferredChannel', name: 'Preferred Channel', type: 'STRING', description: "Contact's preferred communication channel", example: 'SMS', group: 'Contact' },

  // Trip variables
  { path: 'trip.id', name: 'Trip ID', type: 'STRING', description: 'Unique trip identifier', example: 'clxyz123', group: 'Trip' },
  { path: 'trip.status', name: 'Trip Status', type: 'STRING', description: 'Current trip status', example: 'BOOKED', group: 'Trip' },
  { path: 'trip.originIcao', name: 'Origin ICAO', type: 'STRING', description: 'Departure airport ICAO code', example: 'KTEB', group: 'Trip' },
  { path: 'trip.destinationIcao', name: 'Destination ICAO', type: 'STRING', description: 'Arrival airport ICAO code', example: 'KBOS', group: 'Trip' },
  { path: 'trip.departureAt', name: 'Departure Time', type: 'DATETIME', description: 'Scheduled departure date and time', example: '2024-06-15 10:00 AM ET', group: 'Trip' },
  { path: 'trip.arrivalAt', name: 'Arrival Time', type: 'DATETIME', description: 'Estimated arrival date and time', example: '2024-06-15 12:00 PM ET', group: 'Trip' },
  { path: 'trip.boardingTime', name: 'Boarding Time', type: 'DATETIME', description: 'Passenger boarding time', example: '2024-06-15 09:30 AM ET', group: 'Trip' },
  { path: 'trip.fboName', name: 'FBO Name', type: 'STRING', description: 'Fixed base operator name', example: 'Signature TEB', group: 'Trip' },
  { path: 'trip.fboAddress', name: 'FBO Address', type: 'STRING', description: 'FBO street address', example: '100 Aviation Way, Teterboro, NJ', group: 'Trip' },
  { path: 'trip.paxCount', name: 'Passenger Count', type: 'NUMBER', description: 'Number of passengers', example: '4', group: 'Trip' },
  { path: 'trip.isDelayed', name: 'Is Delayed', type: 'BOOLEAN', description: 'Whether the trip is delayed', example: 'false', group: 'Trip' },
  { path: 'trip.delayNotes', name: 'Delay Notes', type: 'STRING', description: 'Reason for delay', example: 'Weather delay at origin', group: 'Trip' },
  { path: 'trip.surveyLink', name: 'Survey Link', type: 'URL', description: 'Post-flight survey URL', example: 'https://forms.gle/abc123', group: 'Trip' },
  { path: 'trip.returnDepartureAt', name: 'Return Departure', type: 'DATETIME', description: 'Return flight departure time', example: '2024-06-17 14:00 PM ET', group: 'Trip' },

  // Aircraft variables
  { path: 'aircraft.tailNumber', name: 'Tail Number', type: 'STRING', description: 'Aircraft registration number', example: 'N737SC', group: 'Aircraft' },
  { path: 'aircraft.make', name: 'Make', type: 'STRING', description: 'Aircraft manufacturer', example: 'Boeing', group: 'Aircraft' },
  { path: 'aircraft.model', name: 'Model', type: 'STRING', description: 'Aircraft model', example: '737 BBJ', group: 'Aircraft' },
  { path: 'aircraft.seats', name: 'Seats', type: 'NUMBER', description: 'Number of passenger seats', example: '19', group: 'Aircraft' },
  { path: 'aircraft.homeBaseIcao', name: 'Home Base', type: 'STRING', description: 'Aircraft home base ICAO', example: 'KTEB', group: 'Aircraft' },

  // Quote variables
  { path: 'quote.id', name: 'Quote ID', type: 'STRING', description: 'Unique quote identifier', example: 'clq789', group: 'Quote' },
  { path: 'quote.status', name: 'Quote Status', type: 'STRING', description: 'Current quote status', example: 'SENT', group: 'Quote' },
  { path: 'quote.totalPrice', name: 'Total Price', type: 'NUMBER', description: 'Total quote price', example: '45000', group: 'Quote' },
  { path: 'quote.currency', name: 'Currency', type: 'STRING', description: 'Quote currency code', example: 'USD', group: 'Quote' },
  { path: 'quote.validUntil', name: 'Valid Until', type: 'DATE', description: 'Quote expiry date', example: '2024-06-20', group: 'Quote' },

  // Ticket variables
  { path: 'ticket.id', name: 'Ticket ID', type: 'STRING', description: 'Unique ticket identifier', example: 'clt456', group: 'Ticket' },
  { path: 'ticket.title', name: 'Ticket Title', type: 'STRING', description: 'Ticket subject line', example: 'Flight inquiry - KTEB to KBOS', group: 'Ticket' },
  { path: 'ticket.status', name: 'Ticket Status', type: 'STRING', description: 'Current ticket status', example: 'OPEN', group: 'Ticket' },
  { path: 'ticket.priority', name: 'Priority', type: 'STRING', description: 'Ticket priority level', example: 'HIGH', group: 'Ticket' },
  { path: 'ticket.source', name: 'Source', type: 'STRING', description: 'How the ticket was created', example: 'SMS_INBOUND', group: 'Ticket' },

  // Tenant variables
  { path: 'tenant.name', name: 'Company Name', type: 'STRING', description: 'Your charter company name', example: 'SkyCharter', group: 'Tenant' },
  { path: 'tenant.slug', name: 'Company Slug', type: 'STRING', description: 'URL-safe company identifier', example: 'skycharter', group: 'Tenant' },
]

export function getVariablesByGroup(): Record<string, TemplateVariable[]> {
  const groups: Record<string, TemplateVariable[]> = {}
  for (const variable of VARIABLE_REGISTRY) {
    if (!groups[variable.group]) groups[variable.group] = []
    groups[variable.group]!.push(variable)
  }
  return groups
}

export function searchVariables(query: string): TemplateVariable[] {
  const q = query.toLowerCase()
  return VARIABLE_REGISTRY.filter(
    (v) =>
      v.path.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q),
  )
}
