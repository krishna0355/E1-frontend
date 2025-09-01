// src/components/Timer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  dueAt?: string | null
  startedAt?: string | null
  durationSec?: number      // used first if available
  intervalMs?: number
}

function parseIsoToMs(s?: string | null): number {
  if (!s) return NaN
  const str = String(s)
  // If no timezone info, treat it as UTC by appending 'Z'
  const hasTZ = /[zZ]|[+\-]\d\d:?\d\d$/.test(str)
  const iso = hasTZ ? str : str + 'Z'
  const t = Date.parse(iso)
  return Number.isNaN(t) ? NaN : t
}

export default function Timer({ dueAt, startedAt, durationSec, intervalMs = 1000 }: Props) {
  const startMs = useMemo(() => parseIsoToMs(startedAt), [startedAt])
  const dueMsSrv = useMemo(() => parseIsoToMs(dueAt), [dueAt])

  const [now, setNow] = useState<number>(() => Date.now())
  const intervalRef = useRef<number | null>(null)

  // start ticking once we have a valid start time
  useEffect(() => {
    if (!Number.isFinite(startMs)) return

    // immediate tick to avoid flashing 00:00
    setNow(Date.now())

    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [startMs, intervalMs])

  // nothing to show until started
  if (!Number.isFinite(startMs)) {
    return <span className="badge">⏱ —</span>
  }

  // Prefer client-computed due = startedAt + durationSec (most precise)
  let dueMs: number | undefined
  if (typeof durationSec === 'number' && isFinite(durationSec)) {
    dueMs = startMs + durationSec * 1000
  } else if (Number.isFinite(dueMsSrv)) {
    // fallback to server dueAt
    dueMs = dueMsSrv
  }

  // Allow negative seconds (overdue)
  let secs: number
  if (typeof dueMs === 'number') {
    secs = Math.floor((dueMs - now) / 1000) // can be negative
  } else {
    // fallback to elapsed mode (non-negative)
    secs = Math.floor((now - startMs) / 1000)
  }

  const isOverdue = secs < 0
  const abs = Math.abs(secs)
  const mm = Math.floor(abs / 60)
  const ss = String(abs % 60).padStart(2, '0')
  const prefix = isOverdue ? '−' : '' // U+2212 minus

  return (
    <span className={`badge ${isOverdue ? 'bg-red-600/30 text-red-200 border-red-500/30' : ''}`}>
      ⏱ {prefix}{mm}:{ss}
    </span>
  )
}
