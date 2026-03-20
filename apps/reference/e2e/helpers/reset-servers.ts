import { readFile } from 'fs/promises'
import { execSync } from 'child_process'

const STATE_FILE = '/tmp/rls-e2e-state.json'

/**
 * Clear all data from server databases between tests.
 * Uses sqlite3 CLI to ensure test isolation without restarting servers.
 */
export async function resetServerState(): Promise<void> {
  const state = JSON.parse(await readFile(STATE_FILE, 'utf8'))
  const { tmpDir } = state

  const tables = [
    { db: `${tmpDir}/relay.db`, table: 'offline_queue' },
    { db: `${tmpDir}/profiles.db`, table: 'profiles' },
    { db: `${tmpDir}/vault.db`, table: 'documents' },
    { db: `${tmpDir}/vault.db`, table: 'changes' },
  ]

  for (const { db, table } of tables) {
    try {
      execSync(`sqlite3 "${db}" "DELETE FROM ${table};"`, { timeout: 5000 })
    } catch {
      // Table may not exist yet — ignore
    }
  }
}
