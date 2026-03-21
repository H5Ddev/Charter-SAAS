import { render, extractVariables, validateTemplate, resolvePath } from '../../src/modules/notifications/template.engine'

describe('Template Engine', () => {
  describe('render()', () => {
    it('replaces a simple variable', () => {
      const result = render('Hello {{name}}!', { name: 'John' })
      expect(result).toBe('Hello John!')
    })

    it('replaces multiple variables in one template', () => {
      const result = render(
        'Hi {{firstName}} {{lastName}}, your flight departs {{departure}}.',
        { firstName: 'Jane', lastName: 'Doe', departure: 'Monday' },
      )
      expect(result).toBe('Hi Jane Doe, your flight departs Monday.')
    })

    it('resolves nested path: {{trip.fboName}}', () => {
      const result = render('FBO: {{trip.fboName}}', {
        trip: { fboName: 'Signature TEB' },
      })
      expect(result).toBe('FBO: Signature TEB')
    })

    it('resolves deeply nested path: {{contact.address.city}}', () => {
      const result = render('City: {{contact.address.city}}', {
        contact: { address: { city: 'New York' } },
      })
      expect(result).toBe('City: New York')
    })

    it('replaces unknown variable with empty string (does not throw)', () => {
      const result = render('Unknown: {{foo.bar}}', {})
      expect(result).toBe('Unknown: ')
    })

    it('replaces null value with empty string', () => {
      const result = render('Phone: {{contact.phone}}', {
        contact: { phone: null },
      })
      expect(result).toBe('Phone: ')
    })

    it('replaces undefined value with empty string', () => {
      const result = render('Value: {{missing}}', {})
      expect(result).toBe('Value: ')
    })

    it('handles template with no variables', () => {
      const result = render('No variables here.', {})
      expect(result).toBe('No variables here.')
    })

    it('handles multiple occurrences of the same variable', () => {
      const result = render('{{name}} is {{name}}', { name: 'John' })
      expect(result).toBe('John is John')
    })

    it('handles numeric values', () => {
      const result = render('Seats: {{aircraft.seats}}', {
        aircraft: { seats: 19 },
      })
      expect(result).toBe('Seats: 19')
    })

    it('handles boolean values', () => {
      const result = render('Delayed: {{trip.isDelayed}}', {
        trip: { isDelayed: false },
      })
      expect(result).toBe('Delayed: false')
    })

    it('handles complex SMS template S01', () => {
      const template =
        'Hi {{contact.firstName}}, your charter flight has been confirmed! ✈️ ' +
        'Flight {{trip.id}} departs {{trip.originIcao}} → {{trip.destinationIcao}} on {{trip.departureAt}}. ' +
        'Aircraft: {{aircraft.make}} {{aircraft.model}} ({{aircraft.tailNumber}}). – {{tenant.name}}'

      const variables = {
        contact: { firstName: 'John' },
        trip: {
          id: 'clxyz123',
          originIcao: 'KTEB',
          destinationIcao: 'KBOS',
          departureAt: '2024-06-15 10:00 AM',
        },
        aircraft: {
          make: 'Boeing',
          model: '737 BBJ',
          tailNumber: 'N737SC',
        },
        tenant: { name: 'SkyCharter' },
      }

      const result = render(template, variables)
      expect(result).toContain('Hi John')
      expect(result).toContain('Flight clxyz123')
      expect(result).toContain('KTEB → KBOS')
      expect(result).toContain('Boeing 737 BBJ (N737SC)')
      expect(result).toContain('SkyCharter')
    })

    it('handles intermediate null on path (does not throw)', () => {
      const result = render('{{a.b.c}}', { a: null })
      expect(result).toBe('')
    })

    it('handles path through non-object (does not throw)', () => {
      const result = render('{{contact.name.first}}', { contact: { name: 'John' } })
      expect(result).toBe('')
    })

    it('handles whitespace in variable path', () => {
      const result = render('{{ contact.firstName }}', {
        contact: { firstName: 'Alice' },
      })
      expect(result).toBe('Alice')
    })
  })

  describe('extractVariables()', () => {
    it('extracts a single variable', () => {
      const vars = extractVariables('Hello {{name}}!')
      expect(vars).toEqual(['name'])
    })

    it('extracts multiple unique variables', () => {
      const vars = extractVariables('{{contact.firstName}} booked {{trip.id}}')
      expect(vars).toContain('contact.firstName')
      expect(vars).toContain('trip.id')
      expect(vars).toHaveLength(2)
    })

    it('deduplicates repeated variables', () => {
      const vars = extractVariables('{{name}} and {{name}}')
      expect(vars).toEqual(['name'])
    })

    it('returns empty array for template with no variables', () => {
      const vars = extractVariables('No variables here.')
      expect(vars).toEqual([])
    })
  })

  describe('validateTemplate()', () => {
    it('returns empty array when all variables are present', () => {
      const missing = validateTemplate('{{contact.firstName}}', {
        contact: { firstName: 'John' },
      })
      expect(missing).toEqual([])
    })

    it('returns missing variable paths', () => {
      const missing = validateTemplate('{{contact.firstName}} {{contact.email}}', {
        contact: { firstName: 'John' },
      })
      expect(missing).toContain('contact.email')
      expect(missing).toHaveLength(1)
    })

    it('returns all missing variables in an empty context', () => {
      const missing = validateTemplate('{{a}} {{b}} {{c}}', {})
      expect(missing).toHaveLength(3)
    })
  })

  describe('resolvePath()', () => {
    it('resolves a top-level path', () => {
      expect(resolvePath({ name: 'John' }, 'name')).toBe('John')
    })

    it('resolves a nested path', () => {
      expect(resolvePath({ trip: { fboName: 'Sig TEB' } }, 'trip.fboName')).toBe('Sig TEB')
    })

    it('returns undefined for missing path', () => {
      expect(resolvePath({}, 'missing.key')).toBeUndefined()
    })

    it('returns undefined when intermediate is null', () => {
      expect(resolvePath({ a: null }, 'a.b')).toBeUndefined()
    })

    it('handles numeric path segments for arrays', () => {
      expect(resolvePath({ items: ['a', 'b'] }, 'items.0')).toBe('a')
    })
  })
})
