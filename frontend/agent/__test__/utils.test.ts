import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  parseCsv,
  escapeCsvField,
  serializeCsvRow,
  appendCsvRow,
  rewriteCsv,
  upsertHints,
  formatTimestamp,
} from '../script/utils.ts'
import { makeTmpDir, rmTmpDir } from './helpers.ts'

let tmpDir: string

beforeEach(() => { tmpDir = makeTmpDir() })
afterEach(() => { rmTmpDir(tmpDir) })

// ─── parseCsv ─────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('returns [] when file does not exist', () => {
    expect(parseCsv(path.join(tmpDir, 'nope.csv'))).toEqual([])
  })

  it('returns [] for empty file', () => {
    const f = path.join(tmpDir, 'empty.csv')
    fs.writeFileSync(f, '')
    expect(parseCsv(f)).toEqual([])
  })

  it('returns [] for whitespace-only file', () => {
    const f = path.join(tmpDir, 'ws.csv')
    fs.writeFileSync(f, '   \n')
    expect(parseCsv(f)).toEqual([])
  })

  it('returns [] for header-only file', () => {
    const f = path.join(tmpDir, 'header.csv')
    fs.writeFileSync(f, 'id,name\n')
    expect(parseCsv(f)).toEqual([])
  })

  it('parses simple two-column CSV', () => {
    const f = path.join(tmpDir, 'simple.csv')
    fs.writeFileSync(f, 'id,name\n1,Alice\n2,Bob\n')
    expect(parseCsv(f)).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])
  })

  it('handles quoted field containing a comma', () => {
    const f = path.join(tmpDir, 'quoted.csv')
    fs.writeFileSync(f, 'id,note\n1,"meals, restaurant"\n')
    expect(parseCsv(f)).toEqual([{ id: '1', note: 'meals, restaurant' }])
  })

  it('handles escaped double-quotes inside quoted field', () => {
    const f = path.join(tmpDir, 'escape.csv')
    fs.writeFileSync(f, 'id,note\n1,"say ""hello"""\n')
    expect(parseCsv(f)).toEqual([{ id: '1', note: 'say "hello"' }])
  })

  it('handles CRLF line endings', () => {
    const f = path.join(tmpDir, 'crlf.csv')
    fs.writeFileSync(f, 'id,name\r\n1,Alice\r\n')
    expect(parseCsv(f)).toEqual([{ id: '1', name: 'Alice' }])
  })

  it('fills missing columns with empty string', () => {
    const f = path.join(tmpDir, 'short.csv')
    fs.writeFileSync(f, 'id,name,extra\n1,Alice\n')
    expect(parseCsv(f)).toEqual([{ id: '1', name: 'Alice', extra: '' }])
  })

  it('parses multi-column row with parentId null literal', () => {
    const f = path.join(tmpDir, 'cats.csv')
    fs.writeFileSync(f, 'id,parentId\ncat1,null\ncat2,cat1\n')
    expect(parseCsv(f)).toEqual([
      { id: 'cat1', parentId: 'null' },
      { id: 'cat2', parentId: 'cat1' },
    ])
  })
})

// ─── escapeCsvField ───────────────────────────────────────────────────────────

describe('escapeCsvField', () => {
  it('returns plain value unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('returns empty string unchanged', () => {
    expect(escapeCsvField('')).toBe('')
  })

  it('wraps in quotes when field contains comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('escapes internal double-quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps in quotes when field contains newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

// ─── serializeCsvRow ──────────────────────────────────────────────────────────

describe('serializeCsvRow', () => {
  it('joins plain fields with commas', () => {
    expect(serializeCsvRow(['a', 'b', 'c'])).toBe('a,b,c')
  })

  it('escapes fields that need quoting', () => {
    expect(serializeCsvRow(['a', 'b,c', 'd'])).toBe('a,"b,c",d')
  })

  it('handles single field', () => {
    expect(serializeCsvRow(['only'])).toBe('only')
  })
})

// ─── appendCsvRow ─────────────────────────────────────────────────────────────

describe('appendCsvRow', () => {
  it('creates file with header when file does not exist', () => {
    const f = path.join(tmpDir, 'new.csv')
    appendCsvRow(f, 'id,name', ['1', 'Alice'])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,name\n1,Alice\n')
  })

  it('appends row to existing file without repeating header', () => {
    const f = path.join(tmpDir, 'existing.csv')
    fs.writeFileSync(f, 'id,name\n1,Alice\n')
    appendCsvRow(f, 'id,name', ['2', 'Bob'])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,name\n1,Alice\n2,Bob\n')
  })

  it('creates parent directories as needed', () => {
    const f = path.join(tmpDir, 'sub', 'deep', 'data.csv')
    appendCsvRow(f, 'x', ['1'])
    expect(fs.existsSync(f)).toBe(true)
  })

  it('escapes field with comma in appended row', () => {
    const f = path.join(tmpDir, 'quotes.csv')
    appendCsvRow(f, 'id,note', ['1', 'meals, restaurant'])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,note\n1,"meals, restaurant"\n')
  })
})

// ─── rewriteCsv ───────────────────────────────────────────────────────────────

describe('rewriteCsv', () => {
  it('writes header and all rows', () => {
    const f = path.join(tmpDir, 'rewrite.csv')
    rewriteCsv(f, 'id,name', [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,name\n1,Alice\n2,Bob\n')
  })

  it('overwrites existing content', () => {
    const f = path.join(tmpDir, 'over.csv')
    fs.writeFileSync(f, 'id,name\n1,Old\n')
    rewriteCsv(f, 'id,name', [{ id: '2', name: 'New' }])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,name\n2,New\n')
  })

  it('writes header only when rows is empty', () => {
    const f = path.join(tmpDir, 'empty.csv')
    rewriteCsv(f, 'id,name', [])
    expect(fs.readFileSync(f, 'utf8')).toBe('id,name\n')
  })
})

// ─── upsertHints ─────────────────────────────────────────────────────────────

describe('upsertHints', () => {
  it('creates file with hint when file does not exist', () => {
    const f = path.join(tmpDir, 'hints.csv')
    upsertHints(f, 'accountId', [{ hint: 'vcb', id: 'acc1' }])
    const rows = parseCsv(f)
    expect(rows).toEqual([{ hint: 'vcb', accountId: 'acc1' }])
  })

  it('adds new hint to existing file', () => {
    const f = path.join(tmpDir, 'hints.csv')
    upsertHints(f, 'accountId', [{ hint: 'vcb', id: 'acc1' }])
    upsertHints(f, 'accountId', [{ hint: 'momo', id: 'acc2' }])
    expect(parseCsv(f)).toHaveLength(2)
  })

  it('overwrites existing hint when same key, new id', () => {
    const f = path.join(tmpDir, 'hints.csv')
    upsertHints(f, 'accountId', [{ hint: 'vcb', id: 'acc1' }])
    upsertHints(f, 'accountId', [{ hint: 'vcb', id: 'acc2' }])
    const rows = parseCsv(f)
    expect(rows).toHaveLength(1)
    expect(rows[0]!['accountId']).toBe('acc2')
  })

  it('keeps unrelated hints when upserting', () => {
    const f = path.join(tmpDir, 'hints.csv')
    upsertHints(f, 'accountId', [
      { hint: 'vcb', id: 'acc1' },
      { hint: 'momo', id: 'acc2' },
    ])
    upsertHints(f, 'accountId', [{ hint: 'vcb', id: 'acc3' }])
    const rows = parseCsv(f)
    expect(rows).toHaveLength(2)
    const momo = rows.find((r) => r['hint'] === 'momo')
    expect(momo?.['accountId']).toBe('acc2')
  })

  it('inserts multiple hints in a single call', () => {
    const f = path.join(tmpDir, 'hints.csv')
    upsertHints(f, 'categoryId', [
      { hint: 'coffee', id: 'cat1' },
      { hint: 'lunch', id: 'cat2' },
      { hint: 'grab', id: 'cat2' },
    ])
    expect(parseCsv(f)).toHaveLength(3)
  })

  it('creates parent directory when it does not exist', () => {
    const f = path.join(tmpDir, 'sub', 'hints.csv')
    upsertHints(f, 'cardId', [{ hint: 'visa', id: 'card1' }])
    expect(fs.existsSync(f)).toBe(true)
  })
})

// ─── formatTimestamp ──────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('formats unix ms as dd/mm/yyyy hh:mm in Asia/Bangkok timezone', () => {
    // 2026-03-17T10:00:00+07:00
    const ms = new Date('2026-03-17T10:00:00+07:00').getTime()
    expect(formatTimestamp(ms)).toBe('17/03/2026 10:00')
  })

  it('handles midnight correctly', () => {
    // 2026-01-01T00:00:00+07:00
    const ms = new Date('2026-01-01T00:00:00+07:00').getTime()
    expect(formatTimestamp(ms)).toBe('01/01/2026 00:00')
  })
})
