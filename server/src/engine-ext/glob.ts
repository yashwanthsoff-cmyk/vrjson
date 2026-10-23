import type { App } from '@contract'
import type { EventMappingRule } from '../types/extra.f03.js'

/**
 * Escapes regex metacharacters except * and ?, then compiles glob pattern to RegExp.
 * Anchored, case-sensitive.
 */
export function globToRegex(pattern: string): RegExp {
  // Regex metacharacters except * and ?: [ \ ^ $ . | ? * + ( )
  // We escape all regex metacharacters, then replace \* with .* and \? with .
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${regexStr}$`)
}

/**
 * Count literal characters in a glob pattern (excluding * and ?)
 */
export function countLiteralCharacters(pattern: string): number {
  return pattern.replace(/[*?]/g, '').length
}

/**
 * Tests if an action matches an actionPattern.
 * Glob pattern safety: never throws on arbitrary input.
 */
export function matchesActionPattern(action: string, pattern: string): boolean {
  try {
    const regex = globToRegex(pattern)
    return regex.test(action)
  } catch {
    return false
  }
}

/**
 * Finds the winning mapping rule for a given action and app from a list of rules.
 * Precedence:
 * 1. Same app only
 * 2. Matches pattern
 * 3. Most specific wins (most literal characters)
 * 4. Lowest rule id (lexicographically)
 */
export function findMatchingRule<T extends EventMappingRule>(
  app: App,
  action: string,
  rules: T[]
): T | null {
  const matchingRules = rules.filter(
    (rule) => rule.app === app && matchesActionPattern(action, rule.actionPattern)
  )

  if (matchingRules.length === 0) {
    return null
  }

  matchingRules.sort((a, b) => {
    const literalsA = countLiteralCharacters(a.actionPattern)
    const literalsB = countLiteralCharacters(b.actionPattern)
    if (literalsB !== literalsA) {
      return literalsB - literalsA // Descending: most specific first
    }
    return a.id.localeCompare(b.id) // Ascending: lowest rule id
  })

  return matchingRules[0]
}
