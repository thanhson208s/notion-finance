export type Archive = {
  id: string
  name: string            // "[MM]-[YYYY]"
  month: number
  year: number
  count: number
  debit: number
  credit: number
  transactionsDbId: string | null
}
