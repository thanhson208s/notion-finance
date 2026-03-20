export type Snapshot = {
  id: string
  name: string      // "[account name]-[MM]-[YYYY]"
  accountId: string // relation to Account DB
  date: number      // ms timestamp
  balance: number
}
