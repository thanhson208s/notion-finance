import { describe, it, expect } from 'vitest'
import { toISOStringWithTimezone } from '../../_lib/connector'

describe('toISOStringWithTimezone()', () => {
  it('returns ISO string with Bangkok +07:00 offset', () => {
    // 2026-03-06T03:30:00Z = 2026-03-06T10:30:00+07:00 in Bangkok
    const ms = new Date('2026-03-06T03:30:00Z').getTime()
    expect(toISOStringWithTimezone(ms, 'Asia/Bangkok')).toBe('2026-03-06T10:30:00+07:00')
  })

  it('format matches ISO 8601 with +07:00 offset', () => {
    expect(toISOStringWithTimezone(Date.now(), 'Asia/Bangkok'))
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/)
  })
})
