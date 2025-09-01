import React, { useState } from 'react'
import AdminPanel from './components/AdminPanel'
import StationPanel from './components/StationPanel'


export default function App(){
const [tab, setTab] = useState<'admin'|'station'>('admin')
return (
<div className="min-h-screen hero">
<div className="max-w-6xl mx-auto p-6">
<header className="flex items-center justify-between mb-6">
<div className="text-2xl font-extrabold">KarmIQ • <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-blue">E1</span></div>
<div className="flex gap-2">
<button onClick={()=>setTab('admin')} className={`btn ${tab==='admin'?'btn-primary':''}`}>Admin</button>
<button onClick={()=>setTab('station')} className={`btn ${tab==='station'?'btn-primary':''}`}>Station</button>
</div>
</header>
{tab==='admin' ? <AdminPanel/> : <StationPanel/>}
</div>
</div>
)
}