import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runArchive } from '../../_handlers/archive.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Archive } from '../../_lib/types/archive.type'
import { Transaction } from '../../_lib/types/transaction.type'

// 2026-06-21 → 3 months back = 2026-03-21, so transactions from 2026-01 are old
const NOW = new Date('2026-06-21T00:00:00Z')

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  // Default: January 2026 Bangkok time (old enough)
  timestamp: new Date('2026-01-15T12:00:00+07:00').getTime(),
  amount: 100,
  categoryId: 'cat-1',
  note: 'test',
  ...overrides
})

const makeArchive = (overrides: Partial<Archive> = {}): Archive => ({
  id: 'arc-1',
  name: '01-2026',
  month: 1,
  year: 2026,
  count: 0,
  debit: 0,
  credit: 0,
  transactionsDbId: 'db-1',
  ...overrides
})

describe('runArchive()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true,"result":{}}', { status: 200 }))
  })

  it('sends Telegram and returns zeros when no old transactions', async () => {
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([])
    })
    const result = await runArchive(connector, NOW)
    expect(result).toEqual({ archived: 0, archivesCreated: 0, archivesUpdated: 0 })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(connector.createArchivePage).not.toHaveBeenCalled()
  })

  it('creates new archive + inline DB when archive does not exist', async () => {
    const tx = makeTx({ fromAccountId: 'acc-1' })
    const newArchive = makeArchive({ transactionsDbId: null })
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([tx]),
      fetchArchive: vi.fn().mockResolvedValue(null),
      createArchivePage: vi.fn().mockResolvedValue(newArchive),
      createArchiveTransactionDb: vi.fn().mockResolvedValue('db-new'),
      setArchiveTransactionsDb: vi.fn().mockResolvedValue(undefined),
      addTransactionToArchiveDb: vi.fn().mockResolvedValue(undefined),
      archiveTransaction: vi.fn().mockResolvedValue(undefined),
      updateArchiveStats: vi.fn().mockResolvedValue(undefined),
    })
    const result = await runArchive(connector, NOW)
    expect(result).toEqual({ archived: 1, archivesCreated: 1, archivesUpdated: 0 })
    expect(connector.createArchivePage).toHaveBeenCalledWith(1, 2026)
    expect(connector.createArchiveTransactionDb).toHaveBeenCalledWith(newArchive.id)
    expect(connector.setArchiveTransactionsDb).toHaveBeenCalledWith(newArchive.id, 'db-new')
    expect(connector.addTransactionToArchiveDb).toHaveBeenCalledWith('db-new', tx)
    expect(connector.archiveTransaction).toHaveBeenCalledWith(tx.id)
  })

  it('uses existing archive when found', async () => {
    const tx = makeTx({ toAccountId: 'acc-1' })
    const existingArchive = makeArchive({ count: 5, debit: 200, credit: 300 })
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([tx]),
      fetchArchive: vi.fn().mockResolvedValue(existingArchive),
      addTransactionToArchiveDb: vi.fn().mockResolvedValue(undefined),
      archiveTransaction: vi.fn().mockResolvedValue(undefined),
      updateArchiveStats: vi.fn().mockResolvedValue(undefined),
    })
    const result = await runArchive(connector, NOW)
    expect(result).toEqual({ archived: 1, archivesCreated: 0, archivesUpdated: 1 })
    expect(connector.createArchivePage).not.toHaveBeenCalled()
    expect(connector.addTransactionToArchiveDb).toHaveBeenCalledWith('db-1', tx)
    expect(connector.archiveTransaction).toHaveBeenCalledWith(tx.id)
  })

  it('groups transactions across two months into separate buckets', async () => {
    const txJan = makeTx({ id: 'tx-jan', timestamp: new Date('2026-01-10T12:00:00+07:00').getTime() })
    const txFeb = makeTx({ id: 'tx-feb', timestamp: new Date('2026-02-10T12:00:00+07:00').getTime() })
    const arcJan = makeArchive({ id: 'arc-jan', month: 1, year: 2026 })
    const arcFeb = makeArchive({ id: 'arc-feb', name: '02-2026', month: 2, year: 2026 })
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([txJan, txFeb]),
      fetchArchive: vi.fn()
        .mockResolvedValueOnce(arcJan)
        .mockResolvedValueOnce(arcFeb),
      addTransactionToArchiveDb: vi.fn().mockResolvedValue(undefined),
      archiveTransaction: vi.fn().mockResolvedValue(undefined),
      updateArchiveStats: vi.fn().mockResolvedValue(undefined),
    })
    const result = await runArchive(connector, NOW)
    expect(result).toEqual({ archived: 2, archivesCreated: 0, archivesUpdated: 2 })
    expect(connector.archiveTransaction).toHaveBeenCalledTimes(2)
    expect(connector.updateArchiveStats).toHaveBeenCalledTimes(2)
  })

  it('calculates debit and credit deltas correctly', async () => {
    const txDebit  = makeTx({ id: 'tx-d', fromAccountId: 'acc-1', toAccountId: undefined, amount: 500 })
    const txCredit = makeTx({ id: 'tx-c', toAccountId: 'acc-1', fromAccountId: undefined, amount: 300 })
    const txTransfer = makeTx({ id: 'tx-t', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 200 })
    const archive = makeArchive({ count: 0, debit: 0, credit: 0 })
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([txDebit, txCredit, txTransfer]),
      fetchArchive: vi.fn().mockResolvedValue(archive),
      addTransactionToArchiveDb: vi.fn().mockResolvedValue(undefined),
      archiveTransaction: vi.fn().mockResolvedValue(undefined),
      updateArchiveStats: vi.fn().mockResolvedValue(undefined),
    })
    await runArchive(connector, NOW)
    // debitDelta = 500 (txDebit) + 200 (txTransfer has fromAccount) = 700
    // creditDelta = 300 (txCredit) + 200 (txTransfer has toAccount) = 500
    expect(connector.updateArchiveStats).toHaveBeenCalledWith('arc-1', 3, 700, 500, archive)
  })

  it('always sends Telegram report after run', async () => {
    const connector = createMockConnector({
      fetchOldTransactions: vi.fn().mockResolvedValue([makeTx()]),
      fetchArchive: vi.fn().mockResolvedValue(makeArchive()),
      addTransactionToArchiveDb: vi.fn().mockResolvedValue(undefined),
      archiveTransaction: vi.fn().mockResolvedValue(undefined),
      updateArchiveStats: vi.fn().mockResolvedValue(undefined),
    })
    await runArchive(connector, NOW)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' })
    )
  })
})
