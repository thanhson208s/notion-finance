import { describe, it, expect } from 'vitest'
import { isAssetType, AccountType } from '../../_lib/types/account.type'

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
