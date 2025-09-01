import React, { useEffect, useMemo, useState } from 'react'
import API from '../api'
import { LabelList } from 'recharts'

// Recharts
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'


/** Lightweight stepper with min/max clamp, keyboard + a11y support */
function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
  ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel?: string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  const dec = () => onChange(clamp(value - step))
  const inc = () => onChange(clamp(value + step))

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value)
    onChange(Number.isFinite(n) ? clamp(n) : min)
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
        disabled ? 'opacity-50' : ''
      }`}
      role="group"
      aria-label={ariaLabel}
    >
      {/* ➖ Button (full circle) */}
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-red-500 text-white text-2xl font-bold shadow hover:opacity-90 active:scale-95 transition disabled:opacity-40"
      >
        –
      </button>

      {/* Wide number box */}
      <input
        inputMode="numeric"
        value={value}
        onChange={onInput}
        className="flex-1 text-center bg-transparent outline-none text-white text-lg font-semibold"
        aria-live="polite"
      />

      {/* ➕ Button (full circle) */}
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r from-brand-purple to-brand-blue text-white text-2xl font-bold shadow hover:opacity-90 active:scale-95 transition disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

/* ---------------- Types ---------------- */
type StationSummary = {
  station_code: string
  display_name: string
  queue: number
  offered: number
  in_progress: number
  done: number
}

type Overview = {
  tasks: {
    total: number
    offered: number
    in_progress: number
    completed: number
  }
  stations: StationSummary[]
}

type UploadResp = {
  ok: boolean
  inserted: number
  duplicates: number
  total_rows: number
  preview: Array<{
    order_id?: string | number | null
    items?: string | null
    qty?: number | null
    est_pack_time_sec?: number | null
    due_by?: string | null
  }>
  error?: string
}

type AllocateResp = {
  assigned: number
  error?: string
}

/* ---------- Performance types & helpers ---------- */
type PerfRow = {
  station_code: string
  display_name: string
  completed: number
  avg_handle_sec: number
  avg_overrun_sec: number   // negative = early, positive = late
  on_time_pct: number
  queued: number
  offered: number
  in_progress: number
}
type PerfResp = { rows: PerfRow[]; generated_at: string }

const secToMin = (s: number) => (s / 60).toFixed(1)
/* -------------------------------------------------- */

/* ---------- Station Admin Types ---------- */
type StationApiRow = {
  station_code?: string
  display_name?: string
  type?: string
  capabilities?: string[] | string
  is_active?: boolean
  // older shape support
  code?: string
  name?: string
  active?: boolean
}

type StationRecord = {
  station_code: string
  display_name: string
  type: 'normal' | 'specialized'
  capabilities: string[]
  is_active: boolean
}

/* ---------------- Small UI helper ---------------- */
function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  )
}

/* ---------------- Charts Section (kept) ---------------- */
/* ---------------- Charts Section (kept + updated) ---------------- */
type ChartsTab = 'stations' | 'trends' | 'distribution' | 'loadDistribution'

const COLOR = {
  queued: '#6366F1',       // indigo
  offered: '#22D3EE',      // cyan
  inProgress: '#FBBF24',   // amber
  completed: '#34D399',    // emerald
  load: '#8B5CF6',         // violet
  timeTaken: '#60A5FA',    // sky
}

const PIE_COLORS = [COLOR.queued, COLOR.offered, COLOR.inProgress, COLOR.completed]

// A nicer tooltip for pies
const pieTooltipBox: React.CSSProperties = {
  background: 'rgba(2, 54, 158, 0.95)', // dark glass
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '10px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
};
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p?.name ?? '';
  const val = p?.value ?? 0;
  const fill = p?.payload?.fill || p?.color || '#fff';
  return (
    <div style={pieTooltipBox}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{name}</div>
      <div style={{ fontWeight: 700, color: fill }}>{val}</div>
    </div>
  );
}

const RAD = Math.PI / 180;
function renderDonutLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name, fill } = props;
  const pct = (percent || 0) * 100;
  const alwaysShow = name === 'Completed' || name === 'In Progress';
  if (!alwaysShow && pct < 3) return null;
  const extra = pct < 3 ? 28 : 18;
  const r = outerRadius + extra;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      textAnchor={anchor}
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 600 }}
    >
      {name} {Math.round(pct)}%
    </text>
  );
}

const tooltipBox: React.CSSProperties = {
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  padding: '10px 12px',
  color: '#fff',
}

/** Always-on donut labels with collision-avoidance + leader lines (stable) */
function makeDonutLabelRenderer(minGap = 16, extraRadius = 22, showValue = true) {
  const usedLeft: number[] = []
  const usedRight: number[] = []
  const RAD = Math.PI / 180

  return function DonutLabel(props: any) {
    const { cx, cy, midAngle, outerRadius, percent, name, value, fill, index } = props
    const pct = (percent || 0) * 100

    if (index === 0) {
      usedLeft.length = 0
      usedRight.length = 0
    }

    const cos = Math.cos(-midAngle * RAD)
    const sin = Math.sin(-midAngle * RAD)

    const x0 = cx + outerRadius * cos
    const y0 = cy + outerRadius * sin

    const r = outerRadius + extraRadius
    let x = cx + r * cos
    let y = cy + r * sin

    const isRight = x >= cx
    const stack = isRight ? usedRight : usedLeft
    const dir = y >= cy ? 1 : -1

    for (let i = 0; i < 60; i++) {
      if (stack.every(yy => Math.abs(yy - y) >= minGap)) break
      y += dir * minGap
    }
    stack.push(y)

    const yLimit = outerRadius + extraRadius + 40
    if (y < cy - yLimit) y = cy - yLimit
    if (y > cy + yLimit) y = cy + yLimit

    const leaderLen = 10
    let x1 = isRight ? x + leaderLen : x - leaderLen
    const xMax = cx + outerRadius + extraRadius + 20
    const xMin = cx - outerRadius - extraRadius - 20
    if (x1 > xMax) x1 = xMax
    if (x1 < xMin) x1 = xMin
    const xText = isRight ? x1 + 6 : x1 - 6
    const anchor: 'start' | 'end' = isRight ? 'start' : 'end'

    const textOut = showValue
      ? `${name} ${Math.round(pct)}% (${value})`
      : `${name} ${Math.round(pct)}%`

    return (
      <g pointerEvents="none">
        <polyline
          points={`${x0},${y0} ${x},${y} ${x1},${y}`}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
        />
        <text
          x={xText}
          y={y}
          textAnchor={anchor}
          dominantBaseline="central"
          style={{ fontSize: 12, fontWeight: 600, fill }}
        >
          {textOut}
        </text>
      </g>
    )
  }
}

function ChartsSection({ stats, perf }: { stats: Overview; perf?: PerfResp | null }) {
  const [tab, setTab] = useState<ChartsTab>('stations')
  const [loadData, setLoadData] = useState<{ name: string; load: number }[]>([])
  const [overallTotal, setOverallTotal] = useState<number>(0)

  const perfMap = useMemo(() => {
    const m: Record<string, PerfRow> = {}
    perf?.rows?.forEach(r => { m[r.station_code] = r })
    return m
  }, [perf])

  const stationsCombined = useMemo(() => {
    return (stats?.stations ?? []).map(s => ({
      name: s.display_name,
      done: s.done,
      queued: s.queue,
      in_progress: s.in_progress,
      offered: s.offered,
    }))
  }, [stats])

  const loadVsTime = useMemo(() => {
    return (stats?.stations ?? []).map(s => {
      const p = perfMap[s.station_code]
      const avgHandleSec = p?.avg_handle_sec ?? 0
      const timeTakenMin = avgHandleSec > 0 ? (avgHandleSec / 60) : 0
      const approxLoadMin = ((s.queue + s.offered + s.in_progress) * avgHandleSec) / 60
      return {
        name: s.display_name,
        loadMin: Number(approxLoadMin.toFixed(1)),
        timeTakenMin: Number(timeTakenMin.toFixed(1)),
      }
    })
  }, [stats, perfMap])

  const trendsRows = useMemo(() => {
    return (stats?.stations ?? []).map(s => {
      const p = perfMap[s.station_code]
      const completed = s.done ?? p?.completed ?? 0
      const timeTakenMin = p?.avg_handle_sec ? (p.avg_handle_sec / 60) : 0
      return {
        name: s.display_name,
        timeTakenMin: Number(timeTakenMin.toFixed(1)),
        completed,
      }
    })
  }, [stats, perfMap])

  // fetch for loadDistribution tab
useEffect(() => {
  if (tab === 'loadDistribution') {
    API.get('/api/load-distribution')
      .then(r => {
        const stations = r.data.stations || []
        const total = r.data.total_time || 0

        // Compute percent properly
        const withPercent = stations.map((s: any) => ({
          ...s,
          percent: total > 0 ? (s.load / total) * 100 : 0
        }))

        setLoadData(withPercent)
        setOverallTotal(total)
      })
      .catch(err => console.error('load distribution fetch failed', err))
  }
}, [tab])

  return (
    <div className="card mt-6 p-4">
      <div className="flex gap-3 mb-4">
        <button onClick={() => setTab('stations')}
          className={`px-4 py-2 rounded-lg transition ${tab === 'stations' ? 'bg-brand-blue text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
          Stations
        </button>
        <button onClick={() => setTab('trends')}
          className={`px-4 py-2 rounded-lg transition ${tab === 'trends' ? 'bg-brand-blue text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
          Trends
        </button>
        <button onClick={() => setTab('distribution')}
          className={`px-4 py-2 rounded-lg transition ${tab === 'distribution' ? 'bg-brand-blue text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
          Distribution
        </button>
        <button onClick={() => setTab('loadDistribution')}
          className={`px-4 py-2 rounded-lg transition ${tab === 'loadDistribution' ? 'bg-brand-blue text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
          Load Time Distribution
        </button>
      </div>

     
{tab === 'stations' && (
        <>
          <div className="mb-6">
            <div className="text-sm opacity-70 mb-2">Work Breakdown</div>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={stationsCombined}>
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis />
                <Tooltip contentStyle={tooltipBox} />
                <Bar dataKey="done"        stackId="A" name="Completed"   fill={COLOR.completed} />
                <Bar dataKey="queued"      stackId="A" name="Queued"      fill={COLOR.queued} />
                <Bar dataKey="in_progress" stackId="B" name="In Progress" fill={COLOR.inProgress} />
                <Bar dataKey="offered"     stackId="B" name="Offered"     fill={COLOR.offered} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.completed}}></span>Completed</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.queued}}></span>Queued</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.inProgress}}></span>In Progress</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.offered}}></span>Offered</span>
            </div>
          </div>

          <div>
            <div className="text-sm opacity-70 mb-2">Total Load Time vs Time Taken (mins)</div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={loadVsTime}>
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis />
                <Tooltip contentStyle={tooltipBox} />
                <Bar dataKey="loadMin"       stackId="C" name="Load (min)"       fill={COLOR.load} />
                <Bar dataKey="timeTakenMin"  stackId="C" name="Time Taken (min)" fill={COLOR.timeTaken} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.load}}></span>Load (min)</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.timeTaken}}></span>Time Taken (min)</span>
            </div>
          </div>
        </>
      )}

      {tab === 'trends' && (
        <>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={trendsRows}>
              <XAxis dataKey="name" stroke="#cbd5e1" />
              <YAxis />
              <Tooltip contentStyle={tooltipBox} />
              <Bar dataKey="timeTakenMin" name="Time Taken (avg min)" fill={COLOR.timeTaken} />
              <Bar dataKey="completed"    name="Completed"           fill={COLOR.completed} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.timeTaken}}></span>Time Taken (avg min)</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.completed}}></span>Completed</span>
          </div>
        </>
      )}

      {tab === 'distribution' && (
        <>
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie
                data={(() => {
                  const queuedTotal = stats.stations.reduce((sum, s) => sum + s.queue, 0)
                  const offeredTotal = stats.stations.reduce((sum, s) => sum + s.offered, 0)
                  const inProgTotal = stats.stations.reduce((sum, s) => sum + s.in_progress, 0)
                  const completedTotal = stats.stations.reduce((sum, s) => sum + s.done, 0)
                  return [
                    { name: 'Queued', value: queuedTotal, fill: COLOR.queued },
                    { name: 'Completed', value: completedTotal, fill: COLOR.completed },
                  ]
                })()}
                cornerRadius={6}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={1}
                cx="50%"
                cy="50%"
                innerRadius={78}
                outerRadius={118}
                dataKey="value"
                nameKey="name"
                isAnimationActive={false}
                paddingAngle={1.6}
                minAngle={2}
                labelLine={false}                              // we draw our own
                label={makeDonutLabelRenderer(16, 22)}
              >
                {PIE_COLORS.map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.queued}}></span>Queued</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.completed}}></span>Completed</span>
          </div>
        </>
      )}

      {/* Load Distribution */}
      {tab === 'loadDistribution' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm opacity-70">Evenly Distributed Load Time (minutes)</div>
            <button
  onClick={async () => {
    try {
      const res = await fetch("https://e1-backend.onrender.com/api/load-distribution/download", {
        method: "GET",
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", "load_distribution.csv")
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("CSV download failed", err)
    }
  }}
  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-blue text-white text-sm font-medium shadow hover:opacity-90 active:scale-95 transition"
>
  ⬇ Download CSV
</button>

          </div>

<ResponsiveContainer width="100%" height={360}>
  <BarChart data={loadData}>
    <XAxis dataKey="name" stroke="#cbd5e1" />
    <YAxis />
    <Tooltip
      contentStyle={tooltipBox}
      formatter={(val: any) => [`${val} mins`, "Load"]}
    />
    <Bar
      dataKey="load"
      name="Load (min)"
      fill={COLOR.load}
      isAnimationActive={false} // prevent blinking
    >
      <LabelList
        dataKey="load"
        position="insideTop"
        content={(props: any) => {
          const { x, y, width, value } = props
          if (value == null) return null
          return (
            <text
              x={x + width / 2} // center horizontally
              y={y != null ? y + 14 : 0} // inside bar
              fill="#fff"
              fontSize={12}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {value}
            </text>
          )
        }}
      />
    </Bar>
  </BarChart>
</ResponsiveContainer>

          <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLOR.load }}></span>
              Load (min)
            </span>
          </div>

          <div className="mt-2 text-sm opacity-70">
            Total load across all stations: <b>{overallTotal.toFixed(1)} mins</b>
          </div>
        </>
      )}
    </div>
  )
}

/** ------------------------
 *  Toast (tiny, no deps)
 *  ------------------------
 */
type ToastState = { id: number; text: string }
function Toast({ toasts, onClose }: { toasts: ToastState[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className="rounded-xl border border-white/10 bg-[#111827]/95 text-white px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg">✅</span>
            <div className="text-sm">{t.text}</div>
            <button
              className="ml-2 text-xs opacity-70 hover:opacity-100"
              onClick={() => onClose(t.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Performance Section (kept) ---------- */
function PerformanceSection({ rows, updated }: { rows: PerfRow[]; updated?: string }) {
  if (!rows?.length) return null

  const completedRows = rows.filter(r => r.completed > 0)
  const bestHandle = completedRows.length ? Math.min(...completedRows.map(r => r.avg_handle_sec)) : null
  const hasEff = completedRows.length && completedRows.some(r => Number.isFinite(r.on_time_pct))
  const bestEff = hasEff ? Math.max(...completedRows.map(r => r.on_time_pct || 0)) : null

  return (
    <div className="card mt-6 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold">Performance</h3>
        {updated && <div className="text-xs opacity-60">Updated: {new Date(updated).toLocaleTimeString()}</div>}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase opacity-70">
            <tr className="text-left">
              <th className="py-2 pr-4">Station</th>
              <th className="py-2 pr-4">Completed</th>
              <th className="py-2 pr-4">Avg Handle (min)</th>
              <th className="py-2 pr-4">Avg Overrun (min)</th>
              <th className="py-2 pr-4">On-Time %</th>
              <th className="py-2 pr-4">Efficiency</th>
              <th className="py-2 pr-4">Now: Q / O / IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBestHandle = bestHandle !== null && r.completed > 0 && r.avg_handle_sec === bestHandle
              const overClass =
                r.avg_overrun_sec > 0 ? 'text-red-300' :
                r.avg_overrun_sec < 0 ? 'text-green-300' : 'opacity-80'

              const eff = r.completed > 0 && Number.isFinite(r.on_time_pct) ? Math.round(r.on_time_pct) : null
              const effClass =
                eff === null ? 'text-gray-400' :
                eff >= 90 ? 'text-green-300' :
                eff >= 75 ? 'text-yellow-300' : 'text-red-300'
              const isBestEff = bestEff !== null && eff !== null && eff === Math.round(bestEff)

              return (
                <tr key={r.station_code} className="border-t border-white/10">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{r.display_name}</div>
                    <div className="text-xs opacity-60">{r.station_code}</div>
                  </td>

                  <td className="py-2 pr-4">{r.completed}</td>

                  <td className="py-2 pr-4">
                    <span className={`badge ${isBestHandle ? 'bg-green-600/30 border-green-500/30 text-green-200' : ''}`}>
                      {secToMin(r.avg_handle_sec)}
                    </span>
                    {isBestHandle && <span className="ml-2 text-xs text-green-300">best</span>}
                  </td>

                  <td className="py-2 pr-4">
                    <span className={`badge ${overClass}`}>
                      {r.avg_overrun_sec > 0 ? '+' : r.avg_overrun_sec < 0 ? '−' : ''}
                      {secToMin(Math.abs(r.avg_overrun_sec))}
                    </span>
                  </td>

                  <td className="py-2 pr-4">
                    <span className={`${r.on_time_pct >= 90 ? 'text-green-300' : r.on_time_pct >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                      {r.completed > 0 ? r.on_time_pct.toFixed(0) + '%' : '—'}
                    </span>
                  </td>

                  <td className="py-2 pr-4">
                    <span className={`font-semibold ${effClass}`}>
                      {eff !== null ? `${eff}%` : '—'}
                    </span>
                    {isBestEff && <span className="ml-2 text-xs text-green-300">top</span>}
                  </td>

                  <td className="py-2 pr-4">
                    <span className="opacity-80">{r.queued}</span>{' / '}
                    <span className="opacity-80">{r.offered}</span>{' / '}
                    <span className="opacity-80">{r.in_progress}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500"></span>Queued (Q)</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-400"></span>Offered (O)</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400"></span>In Progress (IP)</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400"></span>Completed (C)</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400"></span>Efficiency ≥ 90%</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span>Efficiency 75–89%</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400"></span>Efficiency &lt; 75%</div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   Admin Panel (now with Dynamic Seeding + Multi-file Upload + Station Manager)
   ------------------------------------------------------- */
export default function AdminPanel() {
  const [stats, setStats] = useState<Overview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [uploadInfo, setUploadInfo] = useState<UploadResp | null>(null)
  const [allocInfo, setAllocInfo] = useState<AllocateResp | null>(null)

  const [toasts, setToasts] = useState<ToastState[]>([])
  const showToast = (text: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const [perf, setPerf] = useState<PerfResp | null>(null)

  async function refreshPerf() {
    try {
      const r = await API.get<PerfResp>('/admin/performance')
      setPerf(r.data)
    } catch (e) {
      console.error(e)
    }
  }

  async function refresh() {
    try {
      const r = await API.get<Overview>('/admin/overview')
      setStats(r.data)
    } catch (err: any) {
      console.error(err)
      setMessage(err?.response?.data?.error || 'Failed to load overview')
    }
  }

  useEffect(() => {
    const doRefresh = () => { refresh(); refreshPerf(); }
    doRefresh()

    const t1 = setInterval(refresh, 3000)
    const t2 = setInterval(refreshPerf, 5000)

    // listen for station changes (from StationManager or Seed/Reset)
    const onChanged = () => doRefresh()
    window.addEventListener('stations:changed', onChanged)

    return () => {
      clearInterval(t1)
      clearInterval(t2)
      window.removeEventListener('stations:changed', onChanged)
    }
  }, [])


  /* ===========================
     🌟 Dynamic Stations Inputs
     =========================== */
  const [normalCount, setNormalCount] = useState(6)
  const [specializedCount, setSpecializedCount] = useState(0)
  const [capInput, setCapInput] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const totalStations = normalCount + specializedCount

  const addCapability = () => {
    const v = capInput.trim()
    if (v && !capabilities.includes(v)) {
      setCapabilities([...capabilities, v])
      setCapInput('')
    }
  }
  const removeCapability = (cap: string) => {
    setCapabilities(capabilities.filter(c => c !== cap))
  }

  async function seed() {
    setBusy(true)
    setMessage(null)
    try {
      const payload = { normal: normalCount, specialized: specializedCount, capabilities }
      const r = await API.post('/admin/seed-stations', payload)
      setMessage(`Seeded stations: ${r.data?.created ?? 'OK'}`)
      showToast(`🌟 Seeded ${totalStations} stations`)
      window.dispatchEvent(new Event('stations:changed'))
      await refresh()
      await loadStations()
    } catch (err: any) {
      console.error(err)
      setMessage(err?.response?.data?.error || 'Failed to seed stations')
    } finally {
      setBusy(false)
    }
  }

  /* ===========================
     Upload / Allocate / Reset
     =========================== */
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const limited = [...selectedFiles, ...files].slice(0, 5)
    setSelectedFiles(limited)
    e.target.value = ""
  }

  function removeFile(fileName: string) {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName))
  }

  async function uploadSelected() {
    if (!selectedFiles.length) return
    setBusy(true)
    setMessage(null)
    try {
      for (const file of selectedFiles) {
        const fd = new FormData()
        fd.append('file', file, file.name)
        try {
          const r = await API.post<UploadResp>('/admin/upload-orders', fd)
          if (r.data.ok) {
            showToast(`📦 ${file.name} uploaded — ${r.data.inserted} new, ${r.data.duplicates} duplicates`)
          } else {
            showToast(`⚠️ ${file.name} failed — ${r.data.error || 'unknown error'}`)
          }
        } catch (err: any) {
          console.error(err)
          showToast(`❌ ${file.name} upload failed`)
        }
      }
      setSelectedFiles([])
      await refresh()
      await refreshPerf()
    } finally {
      setBusy(false)
    }
  }

  async function allocate() {
    setBusy(true)
    setMessage(null)
    setAllocInfo(null)
    try {
      const r = await API.post<AllocateResp>('/admin/allocate')
      setAllocInfo(r.data)
      if (typeof r.data.assigned === 'number') {
        const msg = `Allocated tasks: ${r.data.assigned}`
        setMessage(msg)
        showToast(`🛠️ Work allocated — ${r.data.assigned} tasks assigned`)
      } else {
        setMessage(r.data.error || 'Allocation finished')
      }
      await refresh()
      await refreshPerf()
    } catch (err: any) {
      console.error(err)
      setMessage(err?.response?.data?.error || 'Allocation failed')
    } finally {
      setBusy(false)
    }
  }

  async function resetAll() {
    if (!confirm('This will delete ALL orders and tasks. Continue?')) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await API.post('/admin/reset')
      const msg = r?.data?.ok
        ? `Reset complete. Orders: ${r.data.orders ?? 0}, Tasks: ${r.data.tasks ?? 0}`
        : 'Reset finished'
      setMessage(msg)
      showToast('🧹 All data reset')
      await refresh()
      await refreshPerf()
      // notify Station Manager to reload its list
      window.dispatchEvent(new CustomEvent('stations:reload'))
    } catch (err: any) {
      console.error(err)
      setMessage(err?.response?.data?.error || 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  /* ===========================
     Station Manager (NEW)
     =========================== */
  const [stations, setStations] = useState<StationRecord[]>([])
  const [editCode, setEditCode] = useState<string | null>(null)

  function normStationRow(row: StationApiRow): StationRecord | null {
    const code = row.station_code || row.code
    const name = row.display_name || row.name || code
    if (!code) return null
    const caps = Array.isArray(row.capabilities)
      ? row.capabilities
      : (row.capabilities ? String(row.capabilities).split(',').map(s => s.trim()).filter(Boolean) : [])
    const type = ((row.type || 'normal') as 'normal' | 'specialized')
    const is_active = (row.is_active ?? row.active ?? true)
    return { station_code: code, display_name: name || code, type, capabilities: caps, is_active }
  }

  async function loadStations() {
    try {
      const r = await API.get('/admin/stations')
      const list = (Array.isArray(r.data) ? r.data : []).map(normStationRow).filter(Boolean) as StationRecord[]
      setStations(list.filter(s => s.is_active))
    } catch (e) {
      console.warn('loadStations failed', e)
    }
  }

  // Add new station form
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'normal' | 'specialized'>('normal')
  const [newCapInput, setNewCapInput] = useState('')
  const [newCaps, setNewCaps] = useState<string[]>([])
  const addNewCap = () => {
    const v = newCapInput.trim()
    if (v && !newCaps.includes(v)) {
      setNewCaps(prev => [...prev, v])
      setNewCapInput('')
    }
  }
  const removeNewCap = (c: string) => setNewCaps(prev => prev.filter(x => x !== c))

  async function addStation() {
    if (!newCode.trim()) {
      showToast('Please provide a station code.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        station_code: newCode.trim(),
        display_name: (newName || newCode).trim(),
        type: newType,
        capabilities: newCaps,
      }
      const r = await API.post('/admin/station/add', payload)
      if (r.data?.ok) {
        showToast(`➕ Station ${payload.station_code} added`)
        setNewCode(''); setNewName(''); setNewType('normal'); setNewCaps([]); setNewCapInput('')
        await loadStations()
        await refresh()
      } else {
        showToast('Add failed')
      }
    } catch (e: any) {
      console.error(e)
      showToast(e?.response?.data?.error || 'Add failed')
    } finally {
      setBusy(false)
    }
  }

  // Edit existing
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'normal' | 'specialized'>('normal')
  const [editCapInput, setEditCapInput] = useState('')
  const [editCaps, setEditCaps] = useState<string[]>([])

  function startEdit(s: StationRecord) {
    setEditCode(s.station_code)
    setEditName(s.display_name)
    setEditType(s.type)
    setEditCaps(s.capabilities)
    setEditCapInput('')
  }

  const addEditCap = () => {
    const v = editCapInput.trim()
    if (v && !editCaps.includes(v)) {
      setEditCaps(prev => [...prev, v])
      setEditCapInput('')
    }
  }
  const removeEditCap = (c: string) => setEditCaps(prev => prev.filter(x => x !== c))

  async function saveEdit() {
    if (!editCode) return
    setBusy(true)
    try {
      const payload = { display_name: editName || editCode, type: editType, capabilities: editCaps }
      const r = await API.put(`/admin/station/edit/${encodeURIComponent(editCode)}`, payload)
      if (r.data?.ok) {
        showToast(`✏️ Station ${editCode} updated`)
        setEditCode(null)
        await loadStations()
        await refresh()
      } else {
        showToast('Update failed')
      }
    } catch (e: any) {
      console.error(e)
      showToast(e?.response?.data?.error || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeStation(code: string) {
    if (!confirm(`Remove station ${code}?`)) return
    setBusy(true)
    try {
      const r = await API.delete(`/admin/station/remove/${encodeURIComponent(code)}`)
      if (r.data?.ok) {
        showToast(`🗑️ Station ${code} removed`)
        await loadStations()
        await refresh()
      } else {
        showToast('Remove failed')
      }
    } catch (e: any) {
      console.error(e)
      showToast(e?.response?.data?.error || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Toasts */}
      <Toast toasts={toasts} onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      <div className="space-y-6">
        {/* HERO */}
        <div className="hero rounded-3xl p-8 border border-white/10">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            Our Services →{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-blue">
              Execution (E1)
            </span>
          </h1>
          <p className="opacity-80 mt-2">
            Packing station load balancer — upload orders, allocate, monitor
            station workloads.
          </p>

          {/* Dynamic inputs */}
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {/* Normal Stations */}
            <div className="p-4 rounded-xl border border-white/10">
              <label className="text-sm opacity-70">Normal Stations</label>
              <div className="mt-2">
                <Stepper
                  value={normalCount}
                  onChange={(v) => setNormalCount(v)}   // min clamp happens inside
                  min={0}
                  step={1}
                  ariaLabel="Normal stations"
                />
              </div>
            </div>

            {/* Specialized Stations */}
            <div className="p-4 rounded-xl border border-white/10">
              <label className="text-sm opacity-70">Specialized Stations</label>
              <div className="mt-2">
                <Stepper
                  value={specializedCount}
                  onChange={(v) => setSpecializedCount(v)}
                  min={0}
                  step={1}
                  ariaLabel="Specialized stations"
                />
              </div>
            </div>

            {/* Capabilities input stays the same */}
            <div className="p-4 rounded-xl border border-white/10">
              <label className="text-sm opacity-70">Capabilities</label>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                  placeholder="fragile, cold-chain..."
                />
                <button onClick={addCapability} className="btn btn-primary">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {capabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2">
                    {cap}
                    <button onClick={() => removeCapability(cap)} className="text-white/70 hover:text-white">✕</button>
                  </span>
                ))}
              </div>
            </div>
          </div>


          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={seed} className="btn btn-primary" disabled={busy}>
              {busy ? 'Seeding…' : `Seed ${totalStations} Stations`}
            </button>

            <div>
              <label
                className={`px-4 py-2 rounded-lg bg-gradient-to-r from-brand-purple to-brand-blue text-white font-medium shadow-md cursor-pointer hover:opacity-90 active:scale-95 transition flex items-center gap-2 ${
                  busy ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                📂 Upload CSV Files
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={busy}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map(f => (
                  <span key={f.name} className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2">
                    {f.name}
                    <button onClick={() => removeFile(f.name)} className="text-white/70 hover:text-white">✕</button>
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                ⚠️ You can upload up to <span className="font-semibold text-white">5 CSV files.</span>
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map(f => (
                  <span
                    key={f.name}
                    className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2"
                  >
                    {f.name}
                    <button onClick={() => removeFile(f.name)} className="text-white/70 hover:text-white">✕</button>
                  </span>
                ))}
              </div>
              {selectedFiles.length > 0 && (
                <button
                  onClick={uploadSelected}
                  className="btn btn-primary mt-2"
                  disabled={busy}
                >
                  {busy ? 'Uploading…' : `Upload Selected (${selectedFiles.length})`}
                </button>
              )}
            </div>

            <button onClick={allocate} className="btn" disabled={busy}>
              {busy ? 'Allocating…' : 'Allocate Work to Stations'}
            </button>

            <button onClick={refresh} className="btn" disabled={busy}>
              Refresh Now
            </button>

            <button
              onClick={resetAll}
              className="btn bg-red-600 hover:bg-red-500 text-white"
              disabled={busy}
              title="Deletes all orders and tasks"
            >
              Reset All (Danger)
            </button>
          </div>

          {message && (
            <div className="mt-4 text-sm p-3 rounded-lg border border-white/10 bg-white/5">
              {message}
            </div>
          )}
        </div>

        {/* ===========================
            Station Manager (NEW SECTION)
            =========================== */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Station Manager</h2>
            <button onClick={loadStations} className="btn">Reload</button>
          </div>

          {/* Add Station */}
          <div className="rounded-xl border border-white/10 p-4 mb-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs opacity-70">Code</label>
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="ST-7"
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Display Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Station 7"
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'normal' | 'specialized')}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                >
                  <option value="normal">normal</option>
                  <option value="specialized">specialized</option>
                </select>
              </div>

              {/* 🔧 UPDATED: Capabilities row so "Add" never overflows */}
              <div>
                <label className="text-xs opacity-70">Capabilities</label>
                <div className="flex items-stretch mt-1">
                  <input
                    value={newCapInput}
                    onChange={(e) => setNewCapInput(e.target.value)}
                    placeholder="fragile, cold-chain..."
                    className="flex-grow rounded-l-lg bg-white/5 border border-white/10 px-3 py-2"
                  />
                  <button
                    className="flex-shrink-0 rounded-r-lg bg-gradient-to-r from-brand-purple to-brand-blue text-white px-2 py-2 font-medium hover:opacity-90 active:scale-95 transition"
                    onClick={addNewCap}
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newCaps.map(c => (
                    <span key={c} className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2">
                      {c}
                      <button onClick={() => removeNewCap(c)} className="text-white/70 hover:text-white">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <button className="btn btn-primary" onClick={addStation} disabled={busy}>Add Station</button>
            </div>
          </div>

          {/* List + Edit/Remove */}
          <div className="grid md:grid-cols-2 gap-4">
            {stations.map(s => (
              <div key={s.station_code} className="p-4 rounded-xl border border-white/10">
                {editCode === s.station_code ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Edit {s.station_code}</div>
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-xs border border-white/10">
                        {editType}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs opacity-70">Display Name</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs opacity-70">Type</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as 'normal' | 'specialized')}
                          className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <option value="normal">normal</option>
                          <option value="specialized">specialized</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs opacity-70">Capabilities</label>

                        {/* 🔧 UPDATED: Edit capabilities row (same fix) */}
                        <div className="flex items-stretch mt-1">
                          <input
                            value={editCapInput}
                            onChange={(e) => setEditCapInput(e.target.value)}
                            className="flex-grow rounded-l-lg bg-white/5 border border-white/10 px-3 py-2"
                            placeholder="add capability…"
                          />
                          <button
                            className="flex-shrink-0 rounded-r-lg bg-gradient-to-r from-brand-purple to-brand-blue text-white px-4 py-2 font-medium hover:opacity-90 active:scale-95 transition"
                            onClick={addEditCap}
                          >
                            Add
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {editCaps.map(c => (
                            <span key={c} className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2">
                              {c}
                              <button onClick={() => removeEditCap(c)} className="text-white/70 hover:text-white">✕</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>Save</button>
                      <button className="btn" onClick={() => setEditCode(null)} disabled={busy}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{s.display_name}</div>
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-xs border border-white/10">
                        {s.type}
                      </span>
                    </div>
                    <div className="text-xs opacity-70">{s.station_code}</div>

                    {s.capabilities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.capabilities.map(c => (
                          <span key={c} className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs">{c}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button className="btn" onClick={() => startEdit(s)} disabled={busy}>Edit</button>
                      <button className="btn bg-red-600 hover:bg-red-500 text-white" onClick={() => removeStation(s.station_code)} disabled={busy}>Remove</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* KPIs */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard title="Total Tasks" value={stats.tasks.total} />
            <StatCard title="Offered" value={stats.tasks.offered} />
            <StatCard title="In Progress" value={stats.tasks.in_progress} />
            <StatCard title="Completed" value={stats.tasks.completed} />
          </div>
        )}

        {/* Station Queues */}
        {stats && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Station Queues</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {stats.stations.map((s) => (
                <div
                  key={s.station_code}
                  className="p-4 rounded-xl border border-white/10"
                >
                  <div className="font-semibold">{s.display_name}</div>
                  <div className="text-sm opacity-70">{s.station_code}</div>
                  <div className="mt-2 text-sm">
                    Queue: <b>{s.queue}</b> · Offered: <b>{s.offered}</b> ·
                    In-Progress: <b>{s.in_progress}</b> · Done: <b>{s.done}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {stats && <ChartsSection stats={stats} perf={perf} />}

        {/* Performance */}
        {perf && <PerformanceSection rows={perf.rows} updated={perf.generated_at} />}

        {/* Allocation summary */}
        {allocInfo && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Last Allocation</h2>
            <div className="text-sm">
              Assigned: <b>{typeof allocInfo.assigned === 'number' ? allocInfo.assigned : '-'}</b>
              {allocInfo.error ? (
                <span className="ml-2 text-red-400">({allocInfo.error})</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
