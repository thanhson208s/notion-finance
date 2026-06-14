import './SwipeableRow.css'
import { useRef } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

const SNAP = 44

// Module-level: track which row is currently open
let activeClose: (() => void) | null = null
let activeId: object | null = null

type SwipeableRowProps = {
  children: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
}

export function SwipeableRow({ children, onEdit, onDelete }: SwipeableRowProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const isOpen = useRef(false)
  const instanceId = useRef({})

  const applyOffset = (offset: number) => {
    const el = contentRef.current
    const actions = actionsRef.current
    if (el) {
      el.style.transition = 'transform 0.25s ease'
      el.style.transform = offset !== 0 ? `translateX(${offset}px)` : ''
    }
    if (actions) {
      actions.style.transition = 'opacity 0.25s ease'
      actions.style.opacity = String(Math.min(1, Math.abs(offset) / SNAP))
    }
  }

  const close = () => {
    isOpen.current = false
    applyOffset(0)
    if (activeId === instanceId.current) {
      activeClose = null
      activeId = null
    }
  }

  const open = () => {
    if (activeClose !== null && activeId !== instanceId.current) activeClose()
    isOpen.current = true
    applyOffset(-SNAP)
    activeClose = close
    activeId = instanceId.current
  }

  const handleContentClick = () => {
    if (isOpen.current) close()
    else open()
  }

  return (
    <div className="swipeable-row">
      <div ref={contentRef} className="swipeable-content" onClick={handleContentClick}>
        {children}
      </div>
      <div ref={actionsRef} className="swipeable-actions">
        <button
          type="button"
          title="Edit"
          className="swipeable-btn swipeable-btn--edit"
          onClick={() => { close(); onEdit?.() }}
        >
          <Pencil size={20} />
        </button>
        <button
          type="button"
          title="Delete"
          className="swipeable-btn swipeable-btn--delete"
          onClick={() => { close(); onDelete?.() }}
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  )
}
