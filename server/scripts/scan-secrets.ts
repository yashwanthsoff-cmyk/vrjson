import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

// Patterns to scan for
const PATTERNS = [
  { name: 'Groq API Key', pattern: /gsk_[a-zA-Z0-9]{40,}/g },
  { name: 'Supabase Service Role JWT', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
]

// Directories to scan
const SCAN_DIRS = ['docs', 'src', 'dist']

// Files to skip
const SKIP_PATTERNS = ['.env', '.env.example', 'node_modules', '.git']

function isGitTracked(filePath: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch "${filePath}"`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => filePath.includes(pattern))
}

function scanFile(filePath: string): { file: string; secrets: string[] } {
  const content = readFileSync(filePath, 'utf-8')
  const secrets: string[] = []

  for (const { name, pattern } of PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      secrets.push(...matches.map((m) => `${name}: ${m.slice(0, 20)}...`))
    }
  }

  return { file: filePath, secrets }
}

function scanDirectory(dir: string, results: any[] = []) {
  const files = readdirSync(dir)

  for (const file of files) {
    const fullPath = join(dir, file)

    if (shouldSkip(fullPath)) continue

    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      scanDirectory(fullPath, results)
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.md') || file.endsWith('.json'))) {
      // Only scan git-tracked files
      if (isGitTracked(fullPath)) {
        const result = scanFile(fullPath)
        if (result.secrets.length > 0) {
          results.push(result)
        }
      }
    }
  }

  return results
}

function main() {
  console.log('Scanning for secrets in git-tracked files...')

  const results: any[] = []

  for (const dir of SCAN_DIRS) {
    try {
      scanDirectory(dir, results)
    } catch (error) {
      // Directory might not exist, skip it
    }
  }

  if (results.length > 0) {
    console.error('\n❌ Secrets found in git-tracked files:\n')
    for (const { file, secrets } of results) {
      console.error(`  ${file}:`)
      for (const secret of secrets) {
        console.error(`    - ${secret}`)
      }
    }
    console.error('\nPlease remove these secrets before committing.')
    process.exit(1)
  } else {
    console.log('✅ No secrets found in git-tracked files.')
  }
}

main()
