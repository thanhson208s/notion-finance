/**
 * onReject.test.ts
 *
 * API_BASE is hardcoded in utils.ts pointing to the real Finance API, so we
 * only test the path that exits before any network call (messageId not found).
 *
 * Scripts run with cwd=env.cwd so './data' resolves to env.dataDir.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  makeScriptEnv,
  rmTmpDir,
  runScript,
  writeSampleAccounts,
  writeSampleCategories,
  writeSampleCards,
  writeSampleMap,
  type ScriptEnv,
} from './helpers.ts'

let env: ScriptEnv

const FRESH = new Date(Date.now() - 60_000).toISOString()
const MSG_ID = '12345'
const TX_ID = 'tx-001'

afterEach(() => { rmTmpDir(env.cwd) })

function makePendingRow(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    messageId: MSG_ID,
    transactionId: TX_ID,
    type: 'Expense',
    amount: '50000',
    accountId: 'acc1',
    categoryId: 'cat2',
    cardId: '-',
    accountRef: 'cash',
    categoryRef: 'lunch',
    cardRef: '-',
    note: 'lunch',
    timestamp: '1742180400000',
    lastModified: Date.now().toString(),
    ...overrides,
  }
}

function setupEnv(rows: Record<string, string>[]) {
  env = makeScriptEnv()
  writeSampleAccounts(env.dataDir, FRESH)
  writeSampleCategories(env.dataDir, FRESH)
  writeSampleCards(env.dataDir, FRESH)
  writeSampleMap(env.dataDir, rows)
}

// ─── Error: messageId not found ───────────────────────────────────────────────

describe('when messageId is not in the map', () => {
  beforeEach(() => setupEnv([]))

  it('exits with code 1 and reports the missing messageId', () => {
    const { stderr, exitCode } = runScript('onReject.ts', [MSG_ID], {}, undefined, env.cwd)
    expect(exitCode).toBe(1)
    const out = JSON.parse(stderr.trim())
    expect(out.success).toBe(false)
    expect(out.error).toContain(MSG_ID)
  })

  it('exits with code 1 for a completely different messageId', () => {
    setupEnv([makePendingRow()])   // has MSG_ID but we query a different one
    const { exitCode } = runScript('onReject.ts', ['99999'], {}, undefined, env.cwd)
    expect(exitCode).toBe(1)
  })
})
