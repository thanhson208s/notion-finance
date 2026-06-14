import { describe, it, expect, vi } from 'vitest'
import { Router } from '../../_lib/router'
import { createMockConnector } from '../helpers/mockConnector'

describe('Router.normalizePath()', () => {
  it('adds /api prefix to bare paths when addPrefix=true', () => {
    expect(Router.normalizePath('/accounts', true)).toBe('/api/accounts')
  })

  it('does not modify paths already starting with /api when addPrefix=false', () => {
    expect(Router.normalizePath('/api/accounts')).toBe('/api/accounts')
  })

  it('strips trailing slash', () => {
    expect(Router.normalizePath('/accounts/')).toBe('/accounts')
  })

  it('does not strip trailing slash on root path "/"', () => {
    expect(Router.normalizePath('/')).toBe('/')
  })
})

describe('Router.normalizeQuery()', () => {
  it('removes keys with undefined values', () => {
    const result = Router.normalizeQuery({ a: '1', b: undefined })
    expect(result).toEqual({ a: '1' })
    expect('b' in result).toBe(false)
  })

  it('keeps keys with defined string values', () => {
    const result = Router.normalizeQuery({ a: '1', b: '2' })
    expect(result).toEqual({ a: '1', b: '2' })
  })
})

describe('Router.resolve()', () => {
  it('returns handler result for a registered route', async () => {
    const connector = createMockConnector()
    const router = new Router(connector)
    const handler = vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } })
    router.register('GET', '/accounts', handler)

    const result = await router.resolve('GET', '/api/accounts', {}, undefined)
    expect(result.statusCode).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('returns 404 for an unregistered route', async () => {
    const connector = createMockConnector()
    const router = new Router(connector)

    const result = await router.resolve('GET', '/api/unknown', {}, undefined)
    expect(result.statusCode).toBe(404)
  })

  it('route key is method uppercased + normalized path with /api prefix', async () => {
    const connector = createMockConnector()
    const router = new Router(connector)
    const handler = vi.fn().mockResolvedValue({ statusCode: 200, body: {} })
    router.register('get', '/accounts', handler)

    // resolve uses the incoming path as-is (no prefix added), so must pass full path
    const result = await router.resolve('get', '/api/accounts', {}, undefined)
    expect(result.statusCode).toBe(200)
  })

  it('passes normalizedQuery to handler, stripping undefined values', async () => {
    const connector = createMockConnector()
    const router = new Router(connector)
    const handler = vi.fn().mockResolvedValue({ statusCode: 200, body: {} })
    router.register('GET', '/test', handler)

    await router.resolve('GET', '/api/test', { a: '1', b: undefined }, undefined)
    const calledQuery = handler.mock.calls[0][0].query
    expect(calledQuery).toEqual({ a: '1' })
  })
})
