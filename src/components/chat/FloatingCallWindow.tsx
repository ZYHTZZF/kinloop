import React, { useRef, useState } from 'react'
import styles from './FloatingCallWindow.module.css'

type FloatingCallWindowProps = {
  title: string
  status: string
  width?: number
  children: React.ReactNode
}

type Point = { x: number; y: number }

const RIGHT_OFFSET = 16
const BOTTOM_OFFSET = 16

const FloatingCallWindow: React.FC<FloatingCallWindowProps> = ({
  title,
  status,
  width = 360,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<Point | null>(null)
  const windowStartRef = useRef<Point | null>(null)
  const [position, setPosition] = useState<Point | null>(null)

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!windowRef.current) return

    const rect = windowRef.current.getBoundingClientRect()
    const startX = position?.x ?? rect.left
    const startY = position?.y ?? rect.top
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    windowStartRef.current = { x: startX, y: startY }

    const onMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current || !windowStartRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.x
      const deltaY = moveEvent.clientY - dragStartRef.current.y

      const nextX = windowStartRef.current.x + deltaX
      const nextY = windowStartRef.current.y + deltaY
      setPosition({
        x: Math.max(0, Math.min(nextX, window.innerWidth - rect.width)),
        y: Math.max(0, Math.min(nextY, window.innerHeight - rect.height)),
      })
    }

    const onUp = () => {
      dragStartRef.current = null
      windowStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={windowRef}
      className={styles.window}
      style={
        position
          ? { left: position.x, top: position.y, width }
          : { right: RIGHT_OFFSET, bottom: BOTTOM_OFFSET, width }
      }
    >
      <div className={styles.header} onMouseDown={handleMouseDown}>
        <div className={styles.titleWrap}>
          <p className={styles.title}>{title}</p>
          <p className={styles.status}>{status}</p>
        </div>
        <span className={styles.dragHint}>拖动</span>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}

export default FloatingCallWindow
