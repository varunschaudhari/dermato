import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({ value, duration = 600, className = '' }) {
  const [display, setDisplay] = useState(value ?? 0)
  const previousValueRef = useRef(value ?? 0)
  const frameRef = useRef(null)

  useEffect(() => {
    if (value === null || value === undefined) {
      return
    }

    const startValue = previousValueRef.current
    const endValue = value
    const startTime = performance.now()

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * eased
      setDisplay(current)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        previousValueRef.current = endValue
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [value, duration])

  if (value === null || value === undefined) {
    return <span className={className}>—</span>
  }

  return <span className={className}>{Math.round(display)}</span>
}
