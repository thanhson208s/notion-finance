import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 80
const MAX_PULL = 110

export function usePullToRefresh(onRefresh: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullDistanceRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { pullDistanceRef.current = 0; setPullDistance(0); return }
      const clamped = Math.min(dy * 0.5, MAX_PULL)
      pullDistanceRef.current = clamped
      setPullDistance(clamped)
    }

    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullDistanceRef.current >= THRESHOLD) {
        setRefreshing(true)
        onRefresh()
        setTimeout(() => setRefreshing(false), 1200)
      }
      pullDistanceRef.current = 0
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onRefresh, containerRef])

  return { pullDistance, refreshing }
}
