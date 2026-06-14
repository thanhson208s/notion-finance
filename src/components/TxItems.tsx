import { ArrowLeftRight, BarChart2, TrendingDown, TrendingUp } from 'lucide-react'
import { type Account, type Card, type Category } from '../App'
import {
  type Transaction, type TxType,
  fmtVND, fmtTxDate, getAccountLabel, getCategoryLabel, getCategoryConfig,
} from '../App'
import { SwipeableRow } from './SwipeableRow'

type SwipeActions = {
  onEdit?: () => void
  onDelete?: () => void
}

const TYPE_COLORS: Record<TxType, string> = {
  'Income':     '#10b981',
  'Expense':    '#ef4444',
  'Transfer':   '#3b82f6',
  'Adjustment': '#64748b',
  'System':     '#64748b',
}

function txIconConfig(catName: string, type: TxType): { icon: React.ReactNode; color: string } {
  const cat = getCategoryConfig(catName)
  if (cat) return { icon: <cat.Icon size={18} />, color: cat.color }
  const color = TYPE_COLORS[type]
  if (type === 'Income') return { icon: <TrendingUp size={18} />, color }
  if (type === 'Expense') return { icon: <TrendingDown size={18} />, color }
  if (type === 'Transfer') return { icon: <ArrowLeftRight size={16} />, color }
  return { icon: <BarChart2 size={16} />, color }
}

// --- Components ---

type TxItemProps = {
  tx: Transaction
  type: TxType
  accounts: Account[]
  cards: Card[]
  catMap: Map<string, Category>
} & SwipeActions

export function TxItem({ tx, type, accounts, cards, catMap, onEdit, onDelete }: TxItemProps) {
  const accountId = tx.fromAccountId ?? tx.toAccountId
  const accountLabel = getAccountLabel(accountId, tx.linkedCardId, accounts, cards)
  const { catName, subName } = getCategoryLabel(tx, catMap)
  const { date, time } = fmtTxDate(tx.timestamp)
  const { icon, color } = txIconConfig(catName, type)
  const typeLower = type.toLowerCase()
  return (
    <SwipeableRow onEdit={onEdit} onDelete={onDelete}>
      <div className="tx-row">
        <div className="tx-icon" style={{ color }}>{icon}</div>
        <div className="tx-mid">
          <span className="tx-account">{accountLabel}</span>
          <span className="tx-category">{catName}{subName ? ` › ${subName}` : ''}</span>
          {tx.note && <span className="tx-note">{tx.note}</span>}
        </div>
        <div className="tx-right">
          <span className="tx-date">{date}</span>
          <span className="tx-time">{time}</span>
          <span className={`tx-amount tx-amount--${typeLower}`}>{fmtVND(tx.amount)}</span>
        </div>
      </div>
    </SwipeableRow>
  )
}

type AdjustmentTxItemProps = {
  tx: Transaction
  accounts: Account[]
  cards: Card[]
  catMap: Map<string, Category>
} & SwipeActions

export function AdjustmentTxItem({ tx, accounts, cards, catMap, onEdit, onDelete }: AdjustmentTxItemProps) {
  const accountId = tx.fromAccountId ?? tx.toAccountId
  const accountLabel = getAccountLabel(accountId, tx.linkedCardId, accounts, cards)
  const { catName, subName } = getCategoryLabel(tx, catMap)
  const { date, time } = fmtTxDate(tx.timestamp)
  const { icon, color } = txIconConfig(catName, 'Adjustment')
  const sign = tx.toAccountId ? '+' : '−'
  return (
    <SwipeableRow onEdit={onEdit} onDelete={onDelete}>
      <div className="tx-row">
        <div className="tx-icon" style={{ color }}>{icon}</div>
        <div className="tx-mid">
          <span className="tx-account">{accountLabel}</span>
          <span className="tx-category">{catName}{subName ? ` › ${subName}` : ''}</span>
          {tx.note && <span className="tx-note">{tx.note}</span>}
        </div>
        <div className="tx-right">
          <span className="tx-date">{date}</span>
          <span className="tx-time">{time}</span>
          <span className="tx-amount tx-amount--adjustment">{sign}{fmtVND(tx.amount)}</span>
        </div>
      </div>
    </SwipeableRow>
  )
}

type TransferTxItemProps = {
  tx: Transaction
  accounts: Account[]
  catMap: Map<string, Category>
} & SwipeActions

export function TransferTxItem({ tx, accounts, catMap, onEdit, onDelete }: TransferTxItemProps) {
  const fromName = accounts.find(a => a.id === tx.fromAccountId)?.name ?? '—'
  const toName = accounts.find(a => a.id === tx.toAccountId)?.name ?? '—'
  const { catName, subName } = getCategoryLabel(tx, catMap)
  const { date, time } = fmtTxDate(tx.timestamp)
  const color = TYPE_COLORS['Transfer']
  return (
    <SwipeableRow onEdit={onEdit} onDelete={onDelete}>
      <div className="tx-row">
        <div className="tx-icon" style={{ color }}><ArrowLeftRight size={16} /></div>
        <div className="tx-mid">
          <span className="tx-account">{fromName} → {toName}</span>
          <span className="tx-category">{catName}{subName ? ` › ${subName}` : ''}</span>
          {tx.note && <span className="tx-note">{tx.note}</span>}
        </div>
        <div className="tx-right">
          <span className="tx-date">{date}</span>
          <span className="tx-time">{time}</span>
          <span className="tx-amount tx-amount--transfer">{fmtVND(tx.amount)}</span>
        </div>
      </div>
    </SwipeableRow>
  )
}
