/**
 * refreshCache.test.ts
 *
 * DATA_DIR is hardcoded as './data' in utils.ts (not env-configurable), so
 * each test runs the script from a temp CWD so that './data' resolves to a
 * fresh isolated directory.
 *
 * API_BASE is hardcoded as https://finance.gootube.online/api. Tests that
 * exercise the refresh path call the real API (it is expected to be live).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  makeScriptEnv,
  rmTmpDir,
  runScript,
  writeSampleAccounts,
  writeSampleCategories,
  writeSampleCards,
  type ScriptEnv,
} from './helpers.ts'

let env: ScriptEnv

const FRESH = new Date(Date.now() - 60_000).toISOString()        // 1 min ago
const STALE = new Date(Date.now() - 200 * 3_600_000).toISOString() // 200 h ago

beforeEach(() => { env = makeScriptEnv() })
afterEach(() => { rmTmpDir(env.cwd) })

// ─── Fresh cache ──────────────────────────────────────────────────────────────

describe('when all cache files exist and are fresh', () => {
  beforeEach(() => {
    writeSampleAccounts(env.dataDir, FRESH)
    writeSampleCategories(env.dataDir, FRESH)
    writeSampleCards(env.dataDir, FRESH)
  })

  it('outputs { success: true, refreshed: false } without calling the API', () => {
    const { stdout, exitCode } = runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    expect(exitCode).toBe(0)
    const out = JSON.parse(stdout.trim())
    expect(out).toEqual({ success: true, refreshed: false })
  })
})

// ─── Missing cache (real API) ─────────────────────────────────────────────────

describe('when cache files are missing', () => {
  it('calls the API, writes all three CSV files, outputs refreshed:true', { timeout: 15_000 }, () => {
    const { stdout, exitCode } = runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    expect(exitCode).toBe(0)

    const out = JSON.parse(stdout.trim())
    expect(out).toEqual({ success: true, refreshed: true })

    expect(fs.existsSync(path.join(env.dataDir, 'accounts.csv'))).toBe(true)
    expect(fs.existsSync(path.join(env.dataDir, 'categories.csv'))).toBe(true)
    expect(fs.existsSync(path.join(env.dataDir, 'cards.csv'))).toBe(true)
  })

  it('accounts.csv has correct header and at least one data row', { timeout: 15_000 }, () => {
    runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    const lines = fs.readFileSync(path.join(env.dataDir, 'accounts.csv'), 'utf8')
      .trim().split('\n')
    expect(lines[0]).toBe('updatedAt,id,name,type,balance,priorityScore')
    expect(lines.length).toBeGreaterThan(1)
  })

  it('categories.csv has correct header and at least one data row', { timeout: 15_000 }, () => {
    runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    const lines = fs.readFileSync(path.join(env.dataDir, 'categories.csv'), 'utf8')
      .trim().split('\n')
    expect(lines[0]).toBe('updatedAt,id,name,type,parentId,note')
    expect(lines.length).toBeGreaterThan(1)
  })

  it('cards.csv has correct header', { timeout: 15_000 }, () => {
    runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    const first = fs.readFileSync(path.join(env.dataDir, 'cards.csv'), 'utf8')
      .trim().split('\n')[0]
    expect(first).toBe('updatedAt,id,accountId,name,number')
  })
})

// ─── Stale cache (real API) ───────────────────────────────────────────────────

describe('when cache files are stale', () => {
  beforeEach(() => {
    writeSampleAccounts(env.dataDir, STALE)
    writeSampleCategories(env.dataDir, STALE)
    writeSampleCards(env.dataDir, STALE)
  })

  it('refreshes and outputs refreshed:true', () => {
    const { stdout, exitCode } = runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    expect(exitCode).toBe(0)
    const out = JSON.parse(stdout.trim())
    expect(out.success).toBe(true)
    expect(out.refreshed).toBe(true)
  }, 15_000)

  it('overwrites stale accounts.csv with fresh data from real API', () => {
    runScript('refreshCache.ts', [], {}, undefined, env.cwd)
    const content = fs.readFileSync(path.join(env.dataDir, 'accounts.csv'), 'utf8')
    // The stale fixture had fake 'acc1' — real API will have different IDs
    expect(content).not.toContain(',acc1,')
  }, 15_000)
})
