import { readFileSync } from 'node:fs'
import { CACError } from './utils.ts'

export function loadConfigFile(filePath: string): Record<string, unknown> {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new CACError(
      `Cannot read config file \`${filePath}\`: ${(err as Error).message}`,
    )
  }

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch (err) {
    throw new CACError(
      `Invalid JSON in config file \`${filePath}\`: ${(err as Error).message}`,
    )
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new CACError(
      `Config file \`${filePath}\` must contain a JSON object`,
    )
  }

  return data as Record<string, unknown>
}
