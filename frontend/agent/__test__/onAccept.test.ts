/**
 * onAccept.test.ts
 *
 * The script performs CSV operations (steps 1-3) BEFORE calling Telegram
 * (step 4). Even though Telegram fails in tests (hardcoded HTTPS + real bot),
 * the CSV side effects are already written and can be asserted.
 *
 * Scripts run with cwd=env.cwd so './data' resolves to env.dataDir.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
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
import { parseCsv } from '../script/utils.ts'

let env: ScriptEnv

const FRESH = new Date(Date.now() - 60_000).toISOString()
const MSG_ID = '12345'

afterEach(() => { rmTmpDir(env.cwd) })

function setupEnv(mapRows: Record<string, string>[]) {
  env = makeScriptEnv()
  writeSampleAccounts(env.dataDir, FRESH)
  writeSampleCategories(env.dataDir, FRESH)
  writeSampleCards(env.dataDir, FRESH)
  writeSampleMap(env.dataDir, mapRows)
}

function makePendingRow(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    messageId: MSG_ID,
    transactionId: 'tx-001',
    type: 'Expense',
    amount: '50000',
    accountId: 'acc1',
    categoryId: 'cat2',
    cardId: '-',
    accountRef: 'text:cash|text:payment',
    categoryRef: 'text:lunch|text:grab',
    cardRef: '-',
    note: 'lunch at restaurant',
    timestamp: '1742180400000',
    lastModified: Date.now().toString(),
    ...overrides,
  }
}

// ─── Error: messageId not found ───────────────────────────────────────────────

describe('when messageId is not in the map', () => {
  beforeEach(() => setupEnv([]))

  it('exits with code 1 and reports the missing messageId', () => {
    const { stderr, exitCode } = runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)
    expect(exitCode).toBe(1)
    const out = JSON.parse(stderr.trim())
    expect(out.success).toBe(false)
    expect(out.error).toContain(MSG_ID)
  })
})

// ─── CSV side effects (before Telegram call) ──────────────────────────────────

describe('when messageId is found', () => {
  it('upserts account hints from accountRef tokens', () => {
    setupEnv([makePendingRow({ accountRef: 'text:vcb' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'account_hints.csv'))
    expect(hints).toHaveLength(1)
    expect(hints[0]!['hint']).toBe('vcb')
    expect(hints[0]!['type']).toBe('text')
    expect(hints[0]!['accountId']).toBe('acc1')
    expect(hints[0]!['cardId']).toBe('-')
  })

  it('upserts visual account hints as single multi-word phrase', () => {
    setupEnv([makePendingRow({ accountRef: 'visual:blue store logo' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'account_hints.csv'))
    expect(hints).toHaveLength(1)
    expect(hints[0]!['type']).toBe('visual')
    expect(hints[0]!['hint']).toBe('blue store logo')
    expect(hints[0]!['accountId']).toBe('acc1')
    expect(hints[0]!['cardId']).toBe('-')
  })

  it('upserts category hints from categoryRef tokens', () => {
    setupEnv([makePendingRow({ categoryRef: 'text:lunch' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'category_hints.csv'))
    expect(hints).toHaveLength(1)
    expect(hints[0]!['hint']).toBe('lunch')
    expect(hints[0]!['type']).toBe('text')
    expect(hints[0]!['categoryId']).toBe('cat2')
  })

  it('stores transaction note in category_hints.csv', () => {
    setupEnv([makePendingRow({ categoryRef: 'text:lunch', note: 'lunch at restaurant' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'category_hints.csv'))
    expect(hints[0]!['note']).toBe('lunch at restaurant')
  })

  it('account_hints.csv has cardId="-" when no card', () => {
    setupEnv([makePendingRow({ cardId: '-', cardRef: '-', accountRef: 'text:vcb' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'account_hints.csv'))
    expect(hints.every((r) => r['cardId'] === '-')).toBe(true)
  })

  it('upserts card hints into account_hints.csv when cardId and cardRef are non-empty', () => {
    setupEnv([makePendingRow({ cardId: 'card1', cardRef: 'text:visa|text:9999' })])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const hints = parseCsv(path.join(env.dataDir, 'account_hints.csv'))
    const cardHints = hints.filter((r) => r['cardId'] === 'card1')
    const hintWords = cardHints.map((r) => r['hint'])
    expect(hintWords).toContain('visa')
    expect(hintWords).toContain('9999')
    expect(cardHints.every((r) => r['accountId'] === 'acc1')).toBe(true)
  })

  it('removes the accepted row from msg_tx_map.csv', () => {
    setupEnv([makePendingRow()])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const remaining = parseCsv(path.join(env.dataDir, 'msg_tx_map.csv'))
    expect(remaining.find((r) => r['messageId'] === MSG_ID)).toBeUndefined()
  })

  it('keeps other non-expired rows in the map', () => {
    setupEnv([
      makePendingRow(),
      makePendingRow({ messageId: '99999', transactionId: 'tx-002' }),
    ])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const remaining = parseCsv(path.join(env.dataDir, 'msg_tx_map.csv'))
    expect(remaining.find((r) => r['messageId'] === '99999')).toBeTruthy()
  })

  it('prunes expired rows (older than 72 hours) from the map', () => {
    const expiredModified = (Date.now() - 80 * 3_600_000).toString()
    setupEnv([
      makePendingRow(),
      makePendingRow({
        messageId: '77777',
        transactionId: 'tx-old',
        lastModified: expiredModified,
      }),
    ])
    runScript('onAccept.ts', [MSG_ID], {}, undefined, env.cwd)

    const remaining = parseCsv(path.join(env.dataDir, 'msg_tx_map.csv'))
    expect(remaining.find((r) => r['messageId'] === '77777')).toBeUndefined()
  })
})
