/**
 * logTransaction.test.ts
 *
 * API_BASE and TELEGRAM credentials are hardcoded in utils.ts, so we only
 * test paths that do NOT call external services (input validation errors).
 *
 * Scripts run with cwd=env.cwd so './data' resolves to env.dataDir.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  makeScriptEnv,
  rmTmpDir,
  runScript,
  type ScriptEnv,
} from './helpers.ts'

let env: ScriptEnv

beforeEach(() => { env = makeScriptEnv() })
afterEach(() => { rmTmpDir(env.cwd) })

// ─── Input validation ─────────────────────────────────────────────────────────

describe('input validation', () => {
  it('exits with code 1 when argument is not valid JSON', () => {
    const { stderr, exitCode } = runScript(
      'logTransaction.ts', ['not-json'], {}, undefined, env.cwd,
    )
    expect(exitCode).toBe(1)
    const out = JSON.parse(stderr.trim())
    expect(out.success).toBe(false)
    expect(out.error).toBeTruthy()
  })

  it('exits with code 1 when no argument and stdin is empty (EOF)', () => {
    const { exitCode } = runScript(
      'logTransaction.ts', [], {}, '', env.cwd,
    )
    expect(exitCode).toBe(1)
  })

  it('exits with code 1 for JSON that is not an object', () => {
    const { exitCode } = runScript(
      'logTransaction.ts', ['42'], {}, undefined, env.cwd,
    )
    // JSON.parse('42') = 42; downstream processing will fail
    expect(exitCode).toBe(1)
  })
})
