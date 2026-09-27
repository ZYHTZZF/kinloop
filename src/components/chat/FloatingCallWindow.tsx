import React, { useMemo, useRef, useState } from 'react'
import styles from './FloatingCallWindow.module.css'

type FloatingCallWindowProps = {
  title: string
  status: string
  width?: number
  children: React.ReactNode
}

type Point = { x: number; y: number }
type Size = { w: number; h: number }

const RIGHT_OFFSET = 16
const BOTTOM_OFFSET = 16
const MIN_WIDTH = 300
const MAX_WIDTH = 760
const MIN_HEIGHT = 220
const MAX_HEIGHT = 760

const FloatingCallWindow: React.FC<FloatingCallWindowProps> = ({
  title,
  status,
  width = 360,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement>(null)

  const dragStartRef = useRef<Point | null>(null)
  const windowStartRef = useRef<Point | null>(null)

  const resizeStartRef = useRef<Point | null>(null)
  const resizeSizeStartRef = useRef<Size | null>(null)

  const [position, setPosition] = useState<Point | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [expanded, setExpanded] = useState(false)

  const viewport = useMemo(() => {
    if (typeof window === 'undefined') {
      return { width: 1440, height: 900 }
    }
    return { width: window.innerWidth, height: window.innerHeight }
  }, [])

  const expandedSize: Size = {
    w: Math.min(560, viewport.width - 24),
    h: Math.min(620, viewport.height - 24),
  }

  const currentSize: Size = expanded
    ? expandedSize
    : {
        w: clamp(size?.w ?? width, MIN_WIDTH, Math.min(MAX_WIDTH, viewport.width - 12)),
        h: clamp(size?.h ?? 420, MIN_HEIGHT, Math.min(MAX_HEIGHT, viewport.height - 12)),
      }

  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!windowRef.current) return

    const target = event.target as HTMLElement
    if (target.closest(`.${styles.headerButton}`)) return

    const rect = windowRef.current.getBoundingClientRect()
    const startX = position?.x ?? rect.left
    const startY = position?.y ?? rect.top

    dragStartRef.current = { x: event.clientX, y: event.clientY }
    windowStartRef.current = { x: startX, y: startY }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleDragPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !windowStartRef.current) return

    const deltaX = event.clientX - dragStartRef.current.x
    const deltaY = event.clientY - dragStartRef.current.y

    const nextX = clamp(windowStartRef.current.x + deltaX, 0, viewport.width - currentSize.w)
    const nextY = clamp(windowStartRef.current.y + deltaY, 0, viewport.height - currentSize.h)
    setPosition({ x: nextX, y: nextY })
  }

  const handleDragPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null
    windowStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStartRef.current = { x: event.clientX, y: event.clientY }
    resizeSizeStartRef.current = { ...currentSize }
    ;(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId)
    event.stopPropagation()
  }

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current || !resizeSizeStartRef.current || expanded) return

    const deltaX = event.clientX - resizeStartRef.current.x
    const deltaY = event.clientY - resizeStartRef.current.y

    const nextW = clamp(resizeSizeStartRef.current.w + deltaX, MIN_WIDTH, Math.min(MAX_WIDTH, viewport.width - 12))
    const nextH = clamp(resizeSizeStartRef.current.h + deltaY, MIN_HEIGHT, Math.min(MAX_HEIGHT, viewport.height - 12))
    setSize({ w: nextW, h: nextH })
  }

  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStartRef.current = null
    resizeSizeStartRef.current = null
    if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
      ;(event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId)
    }
  }

  const toggleExpanded = () => {
    setExpanded((prev) => !prev)
    if (position) {
      const maxX = viewport.width - (expanded ? width : expandedSize.w)
      const maxY = viewport.height - (expanded ? 420 : expandedSize.h)
      setPosition({ x: clamp(position.x, 0, maxX), y: clamp(position.y, 0, maxY) })
    }
  }

  return (
    <div
      ref={windowRef}
      className={styles.window}
      style={
        position
          ? {
              left: position.x,
              top: position.y,
              width: currentSize.w,
              height: currentSize.h,
            }
          : {
              right: RIGHT_OFFSET,
              bottom: BOTTOM_OFFSET,
              width: currentSize.w,
              height: currentSize.h,
            }
      }
    >
      <div
        className={styles.header}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      >
        <div className={styles.titleWrap}>
          <p className={styles.title}>{title}</p>
          <p className={styles.status}>{status}</p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.headerButton} type="button" onClick={toggleExpanded}>
            {expanded ? '还原' : '放大'}
          </button>
          <span className={styles.dragHint}>拖动</span>
        </div>
      </div>

      <div className={styles.body}>{children}</div>

      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        title="拖动缩放"
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default FloatingCallWindow
