import React, { useEffect, useMemo, useState } from 'react'
import API from '../api'



// at the top of StationManager.tsx (or wherever your state lives)
const [stype, setStype] = useState<'normal' | 'specialized'>('normal');

type StationRow = {
  id: number
  station_code: string
  display_name: string
  type: 'normal' | 'specialized' | string
  capabilities: string[]
  is_active: boolean
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default'|'warn'|'danger' }) {
  const cls =
    tone === 'danger' ? 'bg-red-600/30 border-red-500/30 text-red-200' :
    tone === 'warn' ? 'bg-amber-600/30 border-amber-500/30 text-amber-200' :
    'bg-white/10 border-white/20 text-white/90'
  return <span className={`px-2 py-0.5 rounded-lg border text-xs ${cls}`}>{children}</span>
}

function CapChip({ text, onRemove }: { text: string; onRemove?: () => void }) {
  return (
    <span className="px-2 py-1 rounded-lg bg-brand-blue/20 text-brand-blue text-xs flex items-center gap-2">
      {text}
      {onRemove && (
        <button onClick={onRemove} className="text-white/70 hover:text-white" aria-label={`Remove ${text}`}>✕</button>
      )}
    </span>
  )
}

export default function StationManager() {
  const [rows, setRows] = useState<StationRow[]>([])
  const [busy, setBusy] = useState(false)

  // form state
  const [code, setCode] = useState('ST-7')
  const [name, setName] = useState('Station 7')
  const [stype, setStype] = useState<'normal' | 'specialized'>('normal')
  const [capInput, setCapInput] = useState('')
  const [caps, setCaps] = useState<string[]>([])

  // edit modal state (simple inline form per-card)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'normal' | 'specialized'>('normal')
  const [editCaps, setEditCaps] = useState<string[]>([])
  const [editCapInput, setEditCapInput] = useState('')

  async function reload() {
    setBusy(true)
    try {
      const r = await API.get<StationRow[]>('/admin/station-manager/list')
      setRows(r.data)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() }, [])

  function addCap() {
    const v = capInput.trim()
    if (!v) return
    if (!caps.includes(v)) setCaps([...caps, v])
    setCapInput('')
  }

  function removeCap(v: string) {
    setCaps(caps.filter(c => c !== v))
  }

  async function addStation() {
    if (!code.trim()) return
    setBusy(true)
    try {
      await API.post('/admin/station-manager/add', {
        station_code: code.trim(),
        display_name: name.trim() || code.trim(),
        type: stype,
        capabilities: caps,
      })
      // reset hints like your screenshot shows
      setCode(prev => {
        // auto-increment ST-x if format matches
        const m = prev.match(/^ST-(\d+)$/i)
        if (m) return `ST-${Number(m[1]) + 1}`
        return prev
      })
      setName(`Station ${code.replace(/[^0-9]/g,'') || ''}`)
      setCaps([])
      setCapInput('')
      await reload()
    } catch (e:any) {
      alert(e?.response?.data?.error || 'Failed to add station')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(row: StationRow) {
    setEditing(row.station_code)
    setEditName(row.display_name)
    setEditType((row.type as any) === 'specialized' ? 'specialized' : 'normal')
    setEditCaps([...(row.capabilities || [])])
    setEditCapInput('')
  }

  function addEditCap() {
    const v = editCapInput.trim()
    if (!v) return
    if (!editCaps.includes(v)) setEditCaps([...editCaps, v])
    setEditCapInput('')
  }

  async function saveEdit(code: string) {
    setBusy(true)
    try {
      await API.put(`/admin/station-manager/edit/${encodeURIComponent(code)}`, {
        display_name: editName.trim() || code,
        type: editType,
        capabilities: editCaps,
      })
      setEditing(null)
      await reload()
    } catch (e:any) {
      alert(e?.response?.data?.error || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function removeStation(code: string) {
    if (!confirm(`Remove ${code}? (It will be marked inactive)`)) return
    setBusy(true)
    try {
      await API.delete(`/admin/station-manager/remove/${encodeURIComponent(code)}`)
      await reload()
    } catch (e:any) {
      alert(e?.response?.data?.error || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Station Manager</h2>
          <button onClick={reload} className="btn" disabled={busy}>Reload</button>
        </div>

        {/* add form */}
        <div className="grid lg:grid-cols-5 gap-3 mt-4">
          <div>
            <label className="text-sm opacity-70">Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
              placeholder="ST-7"
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
              placeholder="Station 7"
            />
          </div>
          <div>
            <label className="text-sm opacity-70">Type</label>
            // in the JSX
<select
  value={stype}
  onChange={(e) => setStype(e.target.value as 'normal' | 'specialized')}
  className="
    bg-[#111827] text-white
    border border-white/10
    rounded-lg
    px-3 py-2
    focus:outline-none focus:ring-2 focus:ring-brand-blue
  "
>
  <option value="normal" className="bg-[#111827] text-white">normal</option>
  <option value="specialized" className="bg-[#111827] text-white">specialized</option>
</select>

          </div>
          <div className="lg:col-span-2">
            <label className="text-sm opacity-70">Capabilities</label>
            <div className="flex gap-2 mt-2">
              <input
                value={capInput}
                onChange={e => setCapInput(e.target.value)}
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="fragile, cold-chain… (add one by one)"
              />
              <button onClick={addCap} className="btn">Add</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {caps.map(c => <CapChip key={c} text={c} onRemove={() => removeCap(c)} />)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={addStation} className="btn btn-primary" disabled={busy}>Add Station</button>
        </div>
      </div>

      {/* cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {rows.map(row => (
          <div key={row.station_code} className="p-5 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{row.display_name}</div>
                <div className="text-xs opacity-70">{row.station_code}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{(row.type || 'normal')}</Badge>
                {!row.is_active && <Badge tone="warn">inactive</Badge>}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {row.capabilities?.length ? row.capabilities.map(c => (
                <CapChip key={c} text={c} />
              )) : <span className="text-xs opacity-60">No capabilities</span>}
            </div>

            {/* actions */}
            {editing === row.station_code ? (
              <div className="mt-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-2">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    placeholder="Display name"
                  />
                  // in the JSX
<select
  value={stype}
  onChange={(e) => setStype(e.target.value as 'normal' | 'specialized')}
  className="
    bg-[#111827] text-white
    border border-white/10
    rounded-lg
    px-3 py-2
    focus:outline-none focus:ring-2 focus:ring-brand-blue
  "
>
  <option value="normal" className="bg-[#111827] text-white">normal</option>
  <option value="specialized" className="bg-[#111827] text-white">specialized</option>
</select>

                </div>
                <div className="flex gap-2">
                  <input
                    value={editCapInput}
                    onChange={e => setEditCapInput(e.target.value)}
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    placeholder="add capability"
                  />
                  <button className="btn" onClick={addEditCap}>Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editCaps.map(c => (
                    <CapChip key={c} text={c} onRemove={() => setEditCaps(editCaps.filter(x => x !== c))} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={() => saveEdit(row.station_code)} disabled={busy}>Save</button>
                  <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button className="btn" onClick={() => startEdit(row)}>Edit</button>
                <button className="btn bg-red-600 hover:bg-red-500 text-white" onClick={() => removeStation(row.station_code)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
