import React, { useEffect, useMemo, useState } from 'react'
import API from '../api'
import Timer from './Timer'

// Recharts
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

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

/* ---------- Perf types (for time taken) ---------- */
type PerfRow = {
  station_code: string
  display_name: string
  completed: number
  avg_handle_sec: number
  avg_overrun_sec: number
  on_time_pct: number
  queued: number
  offered: number
  in_progress: number
}
type PerfResp = { rows: PerfRow[]; generated_at: string }
/* ------------------------------------------------- */

/* ---------- Station info from /admin/stations ---------- */
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
type StationInfo = {
  station_code: string
  display_name: string
  type: 'normal' | 'specialized'
  capabilities: string[]
  is_active: boolean
}

// ---- Colors + tooltip theme (consistent with Admin) ----
const COLOR = {
  queued: '#6366F1',
  offered: '#22D3EE',
  inProgress: '#FBBF24',
  completed: '#34D399',
  load: '#8B5CF6',
  timeTaken: '#60A5FA',
}

const PIE_COLORS = [COLOR.queued, COLOR.offered, COLOR.inProgress, COLOR.completed]

// ===== Donut label + tooltip helpers (shared) =====
const pieTooltipBox: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.95)', // dark glass
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

// --- Donut label helper (station) ---
const RAD = Math.PI / 180;
function renderStationDonutLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name, fill } = props;
  const pct = (percent || 0) * 100;
  if (pct < 3 && name !== 'Completed' && name !== 'In Progress') return null;

  const r = outerRadius + 14;
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
      style={{ fontSize: 11, fontWeight: 500 }}
    >
      {name} {Math.round(pct)}%
    </text>
  );
}

const tooltipBox: React.CSSProperties = {
  backgroundColor: 'rgba(2, 54, 158, 0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  padding: '10px 12px',
  color: '#fff',
}

/* ---------- helpers ---------- */
function normalizeStationRow(row: StationApiRow): StationInfo | null {
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

function splitPriorityTags(p: string | undefined | null): string[] {
  if (!p) return []
  return String(p)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.toLowerCase())
}

/** Always-on donut labels with collision-avoidance + leader lines (stable) */
function makeDonutLabelRenderer(minGap = 16, extraRadius = 22, showValue = true) {
  const usedLeft: number[] = []
  const usedRight: number[] = []
  const RAD = Math.PI / 180

  return function DonutLabel(props: any) {
    const { cx, cy, midAngle, outerRadius, percent, name, value, fill, index } = props
    const pct = (percent || 0) * 100

    // Reset stacks once per render so they don't accumulate across hovers
    if (index === 0) {
      usedLeft.length = 0
      usedRight.length = 0
    }

    const cos = Math.cos(-midAngle * RAD)
    const sin = Math.sin(-midAngle * RAD)

    // anchor on arc
    const x0 = cx + outerRadius * cos
    const y0 = cy + outerRadius * sin

    // initial outside point
    const r = outerRadius + extraRadius
    let x = cx + r * cos
    let y = cy + r * sin

    const isRight = x >= cx
    const stack = isRight ? usedRight : usedLeft
    const dir = y >= cy ? 1 : -1

    // separate labels vertically
    for (let i = 0; i < 60; i++) {
      if (stack.every(yy => Math.abs(yy - y) >= minGap)) break
      y += dir * minGap
    }
    stack.push(y)

    // clamp so labels never leave the card
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
    const textOut = showValue ? `${name} ${Math.round(pct)}% (${value})` : `${name} ${Math.round(pct)}%`

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

/* ------------------------------------------------------- */

export default function StationPanel() {
  const [code, setCode] = useState('ST-1')
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [perf, setPerf] = useState<PerfResp | null>(null)

  // station info (type, capabilities)
  const [stations, setStations] = useState<StationInfo[]>([])
  const [err, setErr] = useState<string | null>(null)

  async function loadTask() {
    try {
      const r = await API.get(`/station/${code}/current`)
      setTask(r.data.message === 'NO_TASK' ? null : r.data)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load task')
    }
  }

  async function loadOverview() {
    try {
      const r = await API.get<Overview>('/admin/overview')
      setOverview(r.data)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load overview')
    }
  }

  async function loadPerf() {
    try {
      const r = await API.get<PerfResp>('/admin/performance')
      setPerf(r.data)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load performance')
    }
  }

  async function loadStations() {
    try {
      const r = await API.get('/admin/stations')
      const list = (Array.isArray(r.data) ? r.data : [])
        .map(normalizeStationRow)
        .filter(Boolean) as StationInfo[]
      // Sort by code (natural ST-1..ST-10)
      list.sort((a, b) => {
        const na = Number(a.station_code.replace(/\D+/g, '')) || 0
        const nb = Number(b.station_code.replace(/\D+/g, '')) || 0
        return na - nb || a.station_code.localeCompare(b.station_code)
      })
      setStations(list.filter(s => s.is_active))
    } catch (e: any) {
      setErr(e?.message || 'Failed to load stations')
    }
  }

  useEffect(() => {
    // initial
    loadTask()
    loadOverview()
    loadPerf()
    loadStations()

    // polling
    const t1 = setInterval(loadTask, 2000)
    const t2 = setInterval(loadOverview, 4000)
    const t3 = setInterval(loadPerf, 5000)
    return () => {
      clearInterval(t1)
      clearInterval(t2)
      clearInterval(t3)
    }
  }, [code])

  async function accept() {
    if (!task) return
    setLoading(true)
    try {
      const r = await API.post(`/station/${code}/accept`, { task_id: task.task_id })
      if (r?.data && !r.data.error) setTask(r.data)
      else await loadTask()
    } finally {
      setLoading(false)
    }
  }

  async function done() {
    if (!task) return
    setLoading(true)
    try {
      await API.post(`/station/${code}/complete`, { task_id: task.task_id })
      await loadTask()
      await loadOverview()
      await loadPerf()
    } finally {
      setLoading(false)
    }
  }

  // Timer inputs
  const startedAt = task?.started_at || (task?.status === 'IN_PROGRESS' ? new Date().toISOString() : undefined)
  const dueAt = task?.due_at

  // Station-specific stats
  const myStats: StationSummary | null = useMemo(() => {
    if (!overview) return null
    return overview.stations.find(s => s.station_code === code) ?? null
  }, [overview, code])

  // Station capabilities/type
  const myInfo: StationInfo | null = useMemo(() => {
    return stations.find(s => s.station_code === code) ?? null
  }, [stations, code])

  // Performance row for selected station (for avg handle "time taken")
  const myPerf: PerfRow | null = useMemo(() => {
    if (!perf?.rows) return null
    return perf.rows.find(r => r.station_code === code) ?? null
  }, [perf, code])

  /* ----------------- Charts data ----------------- */

  // A) Combined bars: C+Q and IP+O as two stacked bars
  const combinedBars = useMemo(() => {
    if (!myStats) return []
    return [
      {
        name: 'Completed + Queued',
        completed: myStats.done,
        queued: myStats.queue,
        in_progress: 0,
        offered: 0,
      },
      {
        name: 'In Progress + Offered',
        completed: 0,
        queued: 0,
        in_progress: myStats.in_progress,
        offered: myStats.offered,
      },
    ]
  }, [myStats])

  // B) Load vs Time Taken (mins) for this station
  const loadVsTime = useMemo(() => {
    if (!myStats) return []
    const avgHandleSec = myPerf?.avg_handle_sec ?? 0
    const timeTakenMin = avgHandleSec > 0 ? Number((avgHandleSec / 60).toFixed(1)) : 0
    const approxLoadMin = Number((((myStats.queue + myStats.offered + myStats.in_progress) * avgHandleSec) / 60).toFixed(1))
    return [
      {
        name: 'Load vs Time',
        loadMin: approxLoadMin,
        timeTakenMin,
      },
    ]
  }, [myStats, myPerf])

  // C) Distribution pie
  const pieData = useMemo(() => {
    if (!myStats) return []
    return [
      { name: 'Queued', value: myStats.queue },
      { name: 'Offered', value: myStats.offered },
      { name: 'In Progress', value: myStats.in_progress },
      { name: 'Completed', value: myStats.done },
    ]
  }, [myStats])

  // Priority tags for current task (e.g., fragile, cold-chain, rush)
  const taskTags = useMemo(() => splitPriorityTags(task?.order?.priority), [task])

  // Dropdown options (nice labels)
  const stationOptions = useMemo(() => {
    const src = stations.length
      ? stations
      : Array.from({ length: 6 }).map((_, i) => ({
          station_code: `ST-${i + 1}`,
          display_name: `Station ${i + 1}`,
          type: 'normal',
          capabilities: [] as string[],
          is_active: true,
        }))
    return src.map(s => ({
      value: s.station_code,
      label: `${s.display_name}${s.type === 'specialized' ? ' • Specialized' : ''}`,
    }))
  }, [stations])

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-3">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {stationOptions.map(o => (
              <option key={o.value} value={o.value} className="bg-[#111827] text-white">
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => { loadTask(); loadOverview(); loadPerf(); loadStations() }}
            className="btn"
            title="Refresh data"
          >
            Refresh
          </button>

          {err && (
            <div className="text-xs text-red-300 ml-auto">{err}</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">Current Task</h2>
        {!task && <p className="opacity-70 mt-2">No task offered. Please wait…</p>}

        {task && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{task.order.order_id}</div>
                <div className="text-sm opacity-80">{task.order.items}</div>
                <div className="text-sm opacity-70">
                  Qty {task.order.qty}
                </div>

                {/* Priority / Instruction tags */}
                {taskTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {taskTags.map(tag => (
                      <span
                        key={tag}
                        className={`px-2 py-1 rounded-lg text-xs border
                          ${/rush|same-?day|express|expedited|high/.test(tag)
                            ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                            : 'bg-brand-blue/20 border-white/10 text-brand-blue'}
                        `}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="badge">
  Duration: {Math.floor(task.duration_sec / 60)}:{String(task.duration_sec % 60).padStart(2, "0")}
</div>
                {task.status === 'IN_PROGRESS' && startedAt && (
                  <div className="mt-2">
                    <Timer
                      key={`${task.task_id}-${startedAt}`}
                      dueAt={dueAt}
                      startedAt={startedAt}
                      durationSec={task.duration_sec}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              {task.status === 'OFFERED' && (
                <button className="btn btn-primary" onClick={accept} disabled={loading}>
                  {loading ? 'Starting…' : 'Accept & Start'}
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button className="btn" onClick={done} disabled={loading}>
                  {loading ? 'Completing…' : '✔ Mark Done'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- Station Analytics + Capabilities ---- */}
      {myStats && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold">
              {myStats.display_name} • Snapshot
            </h3>

            {/* capability badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-xs capitalize">
                {myInfo?.type || 'normal'}
              </span>
              {(myInfo?.capabilities?.length
                ? myInfo.capabilities
                : ['no-capabilities']
              ).map(c => (
                <span
                  key={c}
                  className={`px-2 py-1 rounded-lg text-xs ${
                    c === 'no-capabilities'
                      ? 'bg-white/5 text-gray-300 border border-white/10'
                      : 'bg-brand-blue/20 text-brand-blue'
                  }`}
                >
                  {c === 'no-capabilities' ? '—' : c}
                </span>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Combined Bars: C+Q and IP+O */}
            <div className="rounded-xl border border-white/10 p-3">
              <div className="text-sm opacity-70 mb-2">Work Breakdown (combined)</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={combinedBars}>
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis />
                    <Tooltip contentStyle={tooltipBox} />
                    <Bar dataKey="completed"    stackId="A" name="Completed"   fill={COLOR.completed} />
<Bar dataKey="queued"       stackId="A" name="Queued"      fill={COLOR.queued} />
<Bar dataKey="in_progress"  stackId="B" name="In Progress" fill={COLOR.inProgress} />
<Bar dataKey="offered"      stackId="B" name="Offered"     fill={COLOR.offered} />

                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.completed}}></span>Completed</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.queued}}></span>Queued</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.inProgress}}></span>In Progress</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.offered}}></span>Offered</span>
              </div>
            </div>

            {/* Load vs Time Taken (mins) */}
            <div className="rounded-xl border border-white/10 p-3">
              <div className="text-sm opacity-70 mb-2">Total Load Time vs Time Taken (mins)</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={loadVsTime}>
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis />
                    <Tooltip contentStyle={tooltipBox} />
                    <Bar dataKey="loadMin"      stackId="C" name="Load (min)"       fill={COLOR.load} />
<Bar dataKey="timeTakenMin" stackId="C" name="Time Taken (min)" fill={COLOR.timeTaken} />

                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.load}}></span>Load (min)</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.timeTaken}}></span>Time Taken (min)</span>
              </div>
            </div>
          </div>

          {/* Donut (distribution) */}
          <div className="rounded-xl border border-white/10 p-3 mt-6">
            <div className="text-sm opacity-70 mb-2">Distribution</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={104}
                    dataKey="value"
                    nameKey="name"
                    isAnimationActive={false}
                    labelLine={false}                      // we draw our own leader lines
                    label={makeDonutLabelRenderer(16, 22, true)}  // always-on labels + values
                    cornerRadius={6}                       // prettier arc ends (optional)
                    stroke="rgba(0,0,0,0.35)"              // subtle separators (optional)
                    strokeWidth={1}
                    paddingAngle={1.6} 
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipBox} />
                  <Bar dataKey="loadMin"      stackId="C" name="Load (min)"       fill={COLOR.load} />
<Bar dataKey="timeTakenMin" stackId="C" name="Time Taken (min)" fill={COLOR.timeTaken} />

                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-5">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.queued}}></span>Queued</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.offered}}></span>Offered</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.inProgress}}></span>In Progress</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor: COLOR.completed}}></span>Completed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
