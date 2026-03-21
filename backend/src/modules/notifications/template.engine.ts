/**
 * Template variable interpolation engine.
 * Supports {{path.to.variable}} syntax with nested paths.
 * Unknown variables are replaced with empty string (never throws).
 */

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

/**
 * Resolve a dot-notation path on an object.
 * Returns undefined if the path does not exist.
 */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.trim().split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Format a value for display in a template.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Render a template string by substituting {{variable}} placeholders.
 *
 * @param template - Template string with {{path.to.variable}} placeholders
 * @param variables - Object containing variable values (supports nested paths)
 * @returns Rendered string with all known variables substituted
 *
 * @example
 * render('Hello {{contact.firstName}}!', { contact: { firstName: 'John' } })
 * // Returns: 'Hello John!'
 *
 * render('FBO: {{trip.fboName}}', { trip: { fboName: 'Signature TEB' } })
 * // Returns: 'FBO: Signature TEB'
 *
 * render('Unknown: {{foo.bar}}', {})
 * // Returns: 'Unknown: '
 */
export function render(template: string, variables: Record<string, unknown>): string {
  return template.replace(VARIABLE_PATTERN, (_match, path: string) => {
    const value = resolvePath(variables, path)
    return formatValue(value)
  })
}

/**
 * Extract all variable paths used in a template.
 * Useful for validation and autocomplete.
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = []
  let match: RegExpExecArray | null

  const regex = new RegExp(VARIABLE_PATTERN.source, 'g')
  while ((match = regex.exec(template)) !== null) {
    if (match[1]) {
      matches.push(match[1].trim())
    }
  }

  return [...new Set(matches)]
}

/**
 * Validate that all variables in a template are present in the provided variables object.
 * Returns a list of missing variable paths.
 */
export function validateTemplate(
  template: string,
  variables: Record<string, unknown>,
): string[] {
  const paths = extractVariables(template)
  return paths.filter((path) => {
    const value = resolvePath(variables, path)
    return value === undefined || value === null
  })
}
