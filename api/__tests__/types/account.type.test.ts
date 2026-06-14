import { describe, it, expect } from 'vitest'
import { isAssetType, AccountType, computePriorityScore } from '../../_lib/types/account.type'

describe('isAssetType()', () => {
  const assetTypes: AccountType[] = ['Cash', 'Prepaid', 'eWallet', 'Bank', 'Loan', 'Savings', 'Gold', 'Fund', 'Bond', 'Stock']
  const liabilityTypes: AccountType[] = ['Credit', 'Debt', 'Crypto', 'PayLater']

  it.each(assetTypes)('returns true for asset type: %s', (type) => {
    expect(isAssetType(type)).toBe(true)
  })

  it.each(liabilityTypes)('returns false for liability type: %s', (type) => {
    expect(isAssetType(type)).toBe(false)
  })
})

describe('computePriorityScore()', () => {
  const DAY_MS = 86_400_000

  it('returns 0 when both totalTransactions and lastTransactionDate are null', () => {
    expect(computePriorityScore(null, null)).toBe(0)
  })

  it('returns 0.6 for 0 transactions used today', () => {
    const now = Date.now()
    const score = computePriorityScore(0, now, now)
    expect(score).toBeCloseTo(0.6, 10)
  })

  it('returns 0.4 * log(11) + 0.6 for 10 transactions used today', () => {
    const now = Date.now()
    const score = computePriorityScore(10, now, now)
    expect(score).toBeCloseTo(0.4 * Math.log(11) + 0.6, 10)
  })

  it('returns 0.3 for 0 transactions used 30 days ago', () => {
    const now = Date.now()
    const score = computePriorityScore(0, now - 30 * DAY_MS, now)
    expect(score).toBeCloseTo(0.6 * 0.5, 10)
  })

  it('returns 0.15 for 0 transactions used 60 days ago', () => {
    const now = Date.now()
    const score = computePriorityScore(0, now - 60 * DAY_MS, now)
    expect(score).toBeCloseTo(0.6 * 0.25, 10)
  })

  it('returns frequency-only score when lastTransactionDate is null', () => {
    const score = computePriorityScore(10, null)
    expect(score).toBeCloseTo(0.4 * Math.log(11), 10)
  })
})
