'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Download, Eye, FilePlus2, Pencil, Plus, Trash2, Upload, XCircle, Lock, MessageSquare, UserPlus, RefreshCcw } from 'lucide-react'
import { useDemoAuth } from '@/lib/demo/auth'
import type { ModuleId, PermissionAction } from '@/lib/demo/types'

type Row = Record<string, string | number>

type ActionDef = {
  label: string
  action: string
  icon?: React.ElementType
}

type DemoModulePageProps = {
  moduleId: ModuleId
  title: string
  subtitle: string
  stats: { label: string; value: string | number; helper?: string }[]
  columns: string[]
  rows: Row[]
  actions: ActionDef[]
  createLabel?: string
  focusTitle: string
  focusItems?: string[]
}

const defaultIconMap: Record<string, React.ElementType> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  assign: UserPlus,
  review: MessageSquare,
  approve: CheckCircle2,
  upload: Upload,
  export: Download,
  lock: Lock,
  submit: FilePlus2,
  mark: CheckCircle2,
  reply: MessageSquare,
  resolve: CheckCircle2,
  download: Download,
  validate: CheckCircle2,
}

export function DemoModulePage({ moduleId, title, subtitle, stats, columns, rows, actions, createLabel, focusTitle, focusItems = [] }: DemoModulePageProps) {
  const { can, role } = useDemoAuth()
  const [records, setRecords] = useState<Row[]>(rows)
  const [newName, setNewName] = useState('')
  const [notice, setNotice] = useState('')

  const allowedActions = useMemo(() => actions.filter((a) => can(`${moduleId}.${a.action}`)), [actions, can, moduleId, role])

  const handleAdd = () => {
    if (!newName.trim()) return
    setRecords((prev) => [{ id: `new-${Date.now()}`, [columns[0]]: newName.trim(), status: 'Active', scope: 'Demo scope' }, ...prev])
    setNewName('')
    setNotice('Demo record added in local state.')
  }

  const handleDelete = (idx: number) => {
    setRecords((prev) => prev.filter((_, i) => i !== idx))
    setNotice('Demo record deleted from local state.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{subtitle}</p>
        </div>
        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border bg-card p-5">
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            {stat.helper && <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{stat.helper}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {can(`${moduleId}.create`) && createLabel && (
            <div className="border border-border bg-card p-5">
              <h2 className="text-xl font-bold">{createLabel}</h2>
              <div className="mt-4 flex gap-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Enter ${title.toLowerCase()} name`} className="h-11 flex-1 border border-border bg-background px-4 outline-none focus:border-[#153e90]" />
                <button type="button" onClick={handleAdd} className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-2 font-semibold text-white"><Plus className="h-4 w-4" />Add</button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">{focusTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Realistic demo data for client presentation.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allowedActions.filter((a) => !['view','create','edit','delete'].includes(a.action)).map((a) => {
                  const Icon = a.icon || defaultIconMap[a.action] || RefreshCcw
                  return <button key={a.label} type="button" onClick={() => setNotice(`${a.label} action completed in demo.`)} className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"><Icon className="h-4 w-4" />{a.label}</button>
                })}
              </div>
            </div>

            {notice && <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">{notice}</div>}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    {columns.map((c) => <th key={c} className="px-4 py-3 font-semibold">{c}</th>)}
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row, idx) => (
                    <tr key={String(row.id || idx)} className="border-b border-border">
                      {columns.map((c) => <td key={c} className="px-4 py-3 text-muted-foreground"><span className={c.toLowerCase().includes('status') ? 'border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground' : ''}>{String(row[c] ?? '-')}</span></td>)}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {can(`${moduleId}.view`) && <button className="border border-border p-2 hover:bg-accent" title="View"><Eye className="h-4 w-4" /></button>}
                          {can(`${moduleId}.edit`) && <button onClick={() => setNotice('Edit saved in demo.')} className="border border-border p-2 hover:bg-accent" title="Edit"><Pencil className="h-4 w-4" /></button>}
                          {allowedActions.filter((a) => ['review','approve','validate','submit','mark','reply','resolve','download'].includes(a.action)).slice(0, 2).map((a) => {
                            const Icon = a.icon || defaultIconMap[a.action] || CheckCircle2
                            return <button key={a.label} onClick={() => setNotice(`${a.label} action completed in demo.`)} className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"><Icon className="h-4 w-4" />{a.label}</button>
                          })}
                          {can(`${moduleId}.delete`) && <button onClick={() => handleDelete(idx)} className="border border-border p-2 hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Allowed actions</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((a) => {
                const allowed = can(`${moduleId}.${a.action}`)
                return <span key={a.label} className={allowed ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white' : 'border border-border px-3 py-1 text-xs text-muted-foreground line-through'}>{a.label}</span>
              })}
            </div>
          </div>
          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Workflow notes</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {focusItems.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#153e90] dark:text-[#6ee75a]" />{item}</li>)}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
