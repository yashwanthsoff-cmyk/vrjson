import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
const openingTags = [...source.matchAll(/<(button|select|input|textarea|Link|a)\b[^>]*>/g)].map((match) => match[0])

describe('interactive action coverage', () => {
  it('gives every interactive opening tag a data-action', () => {
    const missing = openingTags.filter((tag) => !tag.includes('data-action'))
    expect(missing, missing.join('\n')).toEqual([])
  })
  it('gives links navigation and controls a handler or navigation target', () => {
    const delegated = source.includes('onClick={handleAction}') && source.includes('onChange={handleAction}')
    const missing = openingTags.filter((tag) => (tag.startsWith('<Link') || tag.startsWith('<a')) ? !tag.includes('to=') && !tag.includes('href=') : !delegated && !tag.includes('onClick') && !tag.includes('onChange') && !tag.includes('onInput') && !tag.includes('disabled'))
    expect(missing, missing.join('\n')).toEqual([])
  })
})
