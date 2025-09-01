import React from 'react'

export default function StatCard({
  title,
  value,
}: {
  title: string
  value: string | number
}) {
  return (
    <div className="card">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  )
}
