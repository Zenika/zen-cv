export const e2eSchema = 'e2e'

export function e2eDatabaseUrl(testDatabaseUrl: string) {
  const url = new URL(testDatabaseUrl)
  url.searchParams.set('options', `-c search_path=${e2eSchema}`)
  return url.href
}
