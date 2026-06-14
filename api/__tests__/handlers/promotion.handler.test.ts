import { describe, it, expect, vi } from 'vitest'
import { getPromotions, addPromotion, updatePromotion, deletePromotion } from '../../_handlers/promotion.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { QueryError } from '../../_lib/types/error'
import { Promotion } from '../../_lib/types/promotion.type'

const makeEvent = <T>(body?: T, query: Record<string, string> = {}) => ({
  method: 'GET',
  path: '/api/promotions',
  query,
  body: body as T
})

const makePromotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: 'promo-1',
  name: '10% Cashback',
  cardId: 'card-1',
  category: 'Shopping',
  type: 'Cashback',
  expiresAt: null,
  link: null,
  ...overrides
})

describe('getPromotions()', () => {
  it('returns all promotions when no cardId is provided', async () => {
    const promotions = [makePromotion(), makePromotion({ id: 'promo-2' })]
    const connector = createMockConnector({
      fetchPromotions: vi.fn().mockResolvedValue(promotions)
    })
    const result = await getPromotions(makeEvent(undefined), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ promotions })
    expect(connector.fetchPromotions).toHaveBeenCalledWith(undefined)
  })

  it('filters promotions by cardId when provided in query', async () => {
    const promotions = [makePromotion()]
    const connector = createMockConnector({
      fetchPromotions: vi.fn().mockResolvedValue(promotions)
    })
    const result = await getPromotions(makeEvent(undefined, { cardId: 'card-1' }), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ promotions })
    expect(connector.fetchPromotions).toHaveBeenCalledWith('card-1')
  })

  it('passes undefined to connector when cardId is absent', async () => {
    const connector = createMockConnector({
      fetchPromotions: vi.fn().mockResolvedValue([])
    })
    await getPromotions(makeEvent(undefined, {}), connector)
    expect(connector.fetchPromotions).toHaveBeenCalledWith(undefined)
  })
})

describe('addPromotion()', () => {
  it('throws QueryError when name is missing', async () => {
    const connector = createMockConnector()
    await expect(
      addPromotion(makeEvent({ name: '', type: 'Cashback' }), connector)
    ).rejects.toThrow(QueryError)
  })

  it('throws QueryError when type is not Cashback or Discount', async () => {
    const connector = createMockConnector()
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addPromotion(makeEvent({ name: 'Test', type: 'Invalid' as any }), connector)
    ).rejects.toThrow(QueryError)
  })

  it('succeeds with valid Cashback type', async () => {
    const promotion = makePromotion({ type: 'Cashback' })
    const connector = createMockConnector({
      addPromotion: vi.fn().mockResolvedValue(promotion)
    })
    const result = await addPromotion(makeEvent({ name: '10% Cashback', type: 'Cashback' }), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual(promotion)
  })

  it('succeeds with valid Discount type', async () => {
    const promotion = makePromotion({ type: 'Discount' })
    const connector = createMockConnector({
      addPromotion: vi.fn().mockResolvedValue(promotion)
    })
    const result = await addPromotion(makeEvent({ name: '5% Discount', type: 'Discount' }), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual(promotion)
  })

  it('passes full request body to connector', async () => {
    const req = { name: 'Promo', type: 'Cashback' as const, cardId: 'card-1', category: 'Shopping' as const }
    const promotion = makePromotion()
    const addPromotionFn = vi.fn().mockResolvedValue(promotion)
    const connector = createMockConnector({ addPromotion: addPromotionFn })
    await addPromotion(makeEvent(req), connector)
    expect(addPromotionFn).toHaveBeenCalledWith(req)
  })
})

describe('updatePromotion()', () => {
  it('throws QueryError when id is missing from query', async () => {
    const connector = createMockConnector()
    await expect(
      updatePromotion(makeEvent({ name: 'Test', type: 'Cashback' }, {}), connector)
    ).rejects.toThrow(QueryError)
  })

  it('throws QueryError when type is not Cashback or Discount', async () => {
    const connector = createMockConnector()
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatePromotion(makeEvent({ name: 'Test', type: 'Invalid' as any }, { id: 'promo-1' }), connector)
    ).rejects.toThrow(QueryError)
  })

  it('succeeds and returns updated promotion', async () => {
    const promotion = makePromotion({ name: 'Updated' })
    const connector = createMockConnector({
      updatePromotion: vi.fn().mockResolvedValue(promotion)
    })
    const result = await updatePromotion(
      makeEvent({ name: 'Updated', type: 'Cashback' }, { id: 'promo-1' }),
      connector
    )
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual(promotion)
  })

  it('calls connector with the id from query and request body', async () => {
    const req = { name: 'New Name', type: 'Discount' as const }
    const updatePromotionFn = vi.fn().mockResolvedValue(makePromotion())
    const connector = createMockConnector({ updatePromotion: updatePromotionFn })
    await updatePromotion(makeEvent(req, { id: 'promo-99' }), connector)
    expect(updatePromotionFn).toHaveBeenCalledWith('promo-99', req)
  })
})

describe('deletePromotion()', () => {
  it('throws QueryError when id is missing from query', async () => {
    const connector = createMockConnector()
    await expect(
      deletePromotion(makeEvent(undefined, {}), connector)
    ).rejects.toThrow(QueryError)
  })

  it('deletes promotion and returns its id', async () => {
    const connector = createMockConnector({
      deletePromotion: vi.fn().mockResolvedValue(undefined)
    })
    const result = await deletePromotion(makeEvent(undefined, { id: 'promo-1' }), connector)
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ id: 'promo-1' })
  })

  it('calls connector.deletePromotion with the correct id', async () => {
    const deletePromotionFn = vi.fn().mockResolvedValue(undefined)
    const connector = createMockConnector({ deletePromotion: deletePromotionFn })
    await deletePromotion(makeEvent(undefined, { id: 'promo-42' }), connector)
    expect(deletePromotionFn).toHaveBeenCalledWith('promo-42')
  })
})
