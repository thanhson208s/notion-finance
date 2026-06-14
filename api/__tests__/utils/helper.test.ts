import { describe, it, expect } from 'vitest'
import { ok, err, getQueryInt, getQueryFloat, getQueryString, getQueryBool } from '../../_lib/helper'
import { QueryError } from '../../_lib/types/error'

describe('ok()', () => {
  it('returns statusCode 200 with the given data as body', () => {
    const result = ok({ value: 42 })
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ value: 42 })
  })
})

describe('err()', () => {
  it('returns the given statusCode, code, and message', () => {
    const result = err(404, 'NOT_FOUND', 'Resource not found')
    expect(result.statusCode).toBe(404)
    expect(result.body).toEqual({ code: 'NOT_FOUND', message: 'Resource not found' })
  })
})

describe('getQueryInt()', () => {
  describe('required=true', () => {
    it('parses a valid integer string', () => {
      expect(getQueryInt({ page: '5' }, 'page', true)).toBe(5)
    })

    it('throws QueryError when key is absent', () => {
      expect(() => getQueryInt({}, 'page', true)).toThrow(QueryError)
    })

    it('throws QueryError when value is not a number', () => {
      expect(() => getQueryInt({ page: 'abc' }, 'page', true)).toThrow(QueryError)
    })
  })

  describe('required=false', () => {
    it('returns null when key is absent', () => {
      expect(getQueryInt({}, 'page', false)).toBeNull()
    })

    it('returns null when value is NaN', () => {
      expect(getQueryInt({ page: 'abc' }, 'page', false)).toBeNull()
    })
  })
})

describe('getQueryFloat()', () => {
  describe('required=true', () => {
    it('parses a valid float string', () => {
      expect(getQueryFloat({ amount: '3.14' }, 'amount', true)).toBeCloseTo(3.14)
    })

    it('throws QueryError when key is absent', () => {
      expect(() => getQueryFloat({}, 'amount', true)).toThrow(QueryError)
    })
  })

  describe('required=false', () => {
    it('returns null when key is absent', () => {
      expect(getQueryFloat({}, 'amount', false)).toBeNull()
    })
  })
})

describe('getQueryString()', () => {
  describe('required=true', () => {
    it('returns the string value', () => {
      expect(getQueryString({ name: 'Alice' }, 'name', true)).toBe('Alice')
    })

    it('throws QueryError when key is absent', () => {
      expect(() => getQueryString({}, 'name', true)).toThrow(QueryError)
    })
  })

  describe('required=false (was BUG #3)', () => {
    it('returns null when key is absent', () => {
      expect(getQueryString({}, 'name', false)).toBeNull()
    })
  })
})

describe('getQueryBool()', () => {
  describe('required=true', () => {
    it('returns true for a present key with truthy value', () => {
      expect(getQueryBool({ active: 'true' }, 'active', true)).toBe(true)
    })

    it('returns false for a present key with empty string', () => {
      expect(getQueryBool({ active: '' }, 'active', true)).toBe(false)
    })

    it('throws QueryError when key is absent', () => {
      expect(() => getQueryBool({}, 'active', true)).toThrow(QueryError)
    })
  })

  describe('required=false (was BUG #3)', () => {
    it('returns null when key is absent', () => {
      expect(getQueryBool({}, 'active', false)).toBeNull()
    })
  })
})
