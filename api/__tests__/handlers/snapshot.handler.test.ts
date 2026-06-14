import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSnapshot } from '../../_handlers/snapshot.handler'
import { createMockConnector } from '../helpers/mockConnector'
import { Snapshot } from '../../_lib/types/snapshot.type'
import { Transaction } from '../../_lib/types/transaction.type'

// A date that is 2026-02-01 00:00:00+07:00 (Bangkok midnight, 1st of month)
const FIRST_OF_MONTH = new Date('2026-02-01T00:00:00+07:00')

const makeSnapshot = (balance: number, dateMs: number): Snapshot => ({
  id: 'snap-1',
  name: 'Cash-01-2026',
  accountId: 'acc-1',
  date: dateMs,
  balance
})

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  timestamp: Date.now(),
  amount: 100,
  categoryId: 'cat-1',
  note: '',
  ...overrides
})

const makeAccount = (balance: number) => ({
  id: 'acc-1',
  name: 'Cash',
  type: 'Cash' as const,
  balance,
  totalTransactions: 5,
  lastTransactionDate: null,
  priorityScore: 0,
  linkedCardIds: [],
  cards: []
})

describe('runSnapshot()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true,"result":{}}', { status: 200 }))
  })

  it('skips account with no prior snapshot and zero balance', async () => {
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([makeAccount(0)]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(null),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result.results[0]).toMatchObject({ status: 'no_prior_snapshot' })
    expect(connector.createSnapshot).not.toHaveBeenCalled()
  })

  it('bootstraps snapshot from current balance when no prior snapshot and balance !== 0', async () => {
    const snap = { id: 'snap-boot', name: 'Cash-01-02-2026', accountId: 'acc-1', date: Date.now(), balance: 1000 }
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([makeAccount(1000)]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(null),
      createSnapshot: vi.fn().mockResolvedValue(snap),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(connector.createSnapshot).toHaveBeenCalledWith('acc-1', 'Cash', 1000, expect.any(Number))
    expect(result.results[0]).toMatchObject({
      status: 'created',
      calculatedBalance: 1000,
      actualBalance: 1000,
      mismatch: false
    })
  })

  it('skips account with no transactions since last snapshot', async () => {
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([makeAccount(1000)]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(1000, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue([]),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result.results[0]).toMatchObject({ status: 'no_transactions' })
    expect(connector.createSnapshot).not.toHaveBeenCalled()
  })

  it('creates snapshot when account has transactions, no mismatch', async () => {
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const account = makeAccount(1200)
    const txs = [
      makeTx({ toAccountId: 'acc-1', amount: 500 }),   // +500 income
      makeTx({ fromAccountId: 'acc-1', amount: 300 }), // -300 expense
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([account]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(1000, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue(txs),
      createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-new', name: 'Cash-02-2026', accountId: 'acc-1', date: FIRST_OF_MONTH.getTime(), balance: 1200 }),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result).toMatchObject({ mismatches: 0 })
    const r = result.results[0]!
    expect(r.status).toBe('created')
    expect(r.calculatedBalance).toBe(1200) // 1000 + 500 - 300
    expect(r.mismatch).toBe(false)
    expect(connector.createSnapshot).toHaveBeenCalledWith('acc-1', 'Cash', 1200, expect.any(Number))
  })

  it('detects mismatch and sends Telegram message', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true,"result":{}}', { status: 200 }))
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const account = makeAccount(999) // actual balance differs
    const txs = [makeTx({ toAccountId: 'acc-1', amount: 500 })]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([account]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(1000, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue(txs),
      createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-new', name: 'Cash-02-2026', accountId: 'acc-1', date: FIRST_OF_MONTH.getTime(), balance: 1500 }),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result).toMatchObject({ mismatches: 1 })
    expect(result.results[0]!.mismatch).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('always sends Telegram report even when no mismatches', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true,"result":{}}', { status: 200 }))
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const account = makeAccount(1500)
    const txs = [makeTx({ toAccountId: 'acc-1', amount: 500 })]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([account]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(1000, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue(txs),
      createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-new', name: 'Cash-02-2026', accountId: 'acc-1', date: FIRST_OF_MONTH.getTime(), balance: 1500 }),
    })
    await runSnapshot(connector, FIRST_OF_MONTH)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('calculates balance correctly: toAccount adds, fromAccount subtracts', async () => {
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const account = makeAccount(800)
    const txs = [
      makeTx({ toAccountId: 'acc-1', fromAccountId: undefined, amount: 300 }),  // income +300
      makeTx({ fromAccountId: 'acc-1', toAccountId: undefined, amount: 200 }), // expense -200
      makeTx({ toAccountId: 'acc-1', fromAccountId: undefined, amount: 100 }),  // transfer in +100
    ]
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([account]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(600, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue(txs),
      createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-new', name: 'Cash-02-2026', accountId: 'acc-1', date: FIRST_OF_MONTH.getTime(), balance: 800 }),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result.results[0]!.calculatedBalance).toBe(800) // 600 + 300 - 200 + 100
  })

  it('returns correct label for the snapshot month', async () => {
    const prevSnapshotDate = new Date('2026-01-01T00:00:00+07:00').getTime()
    const account = makeAccount(1500)
    const connector = createMockConnector({
      fetchAllAccounts: vi.fn().mockResolvedValue([account]),
      fetchLatestSnapshotForAccount: vi.fn().mockResolvedValue(makeSnapshot(1000, prevSnapshotDate)),
      fetchTransactionsForAccount: vi.fn().mockResolvedValue([makeTx({ toAccountId: 'acc-1', amount: 500 })]),
      createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-new', name: 'Cash-02-2026', accountId: 'acc-1', date: FIRST_OF_MONTH.getTime(), balance: 1500 }),
    })
    const result = await runSnapshot(connector, FIRST_OF_MONTH)
    expect(result).toMatchObject({ label: '01-02-2026' })
  })
})
