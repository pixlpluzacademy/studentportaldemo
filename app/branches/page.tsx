'use client'

import { useMemo, useState } from 'react'

type BranchStatus = 'active' | 'inactive'

type BranchRow = {
  id: string
  branch_name: string
  location: string
  branch_controller: string
  status: BranchStatus
  created_at: string
  updated_at: string
}

const branchControllers = [
  'Anas Rahman',
  'Fathima Noor',
  'Vishnu Raj',
  'Not Assigned',
]

const initialBranches: BranchRow[] = [
  {
    id: 'BR-001',
    branch_name: 'Kochi Branch',
    location: 'Kochi, Kerala',
    branch_controller: 'Anas Rahman',
    status: 'active',
    created_at: '2026-06-01',
    updated_at: '2026-06-03',
  },
  {
    id: 'BR-002',
    branch_name: 'Calicut Branch',
    location: 'Calicut, Kerala',
    branch_controller: 'Not Assigned',
    status: 'inactive',
    created_at: '2026-06-02',
    updated_at: '2026-06-02',
  },
]

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchRow[]>(initialBranches)
  const [open, setOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null)

  const [form, setForm] = useState({
    branch_name: '',
    location: '',
    branch_controller: 'Not Assigned',
    status: 'active' as BranchStatus,
  })

  const stats = useMemo(() => {
    const active = branches.filter((branch) => branch.status === 'active').length
    const inactive = branches.filter((branch) => branch.status === 'inactive').length
    const assigned = branches.filter((branch) => branch.branch_controller !== 'Not Assigned').length

    return [
      {
        label: 'Total Branches',
        value: branches.length,
        helper: 'All pixlpluzportal branches',
      },
      {
        label: 'Active Branches',
        value: active,
        helper: 'Currently operating',
      },
      {
        label: 'Inactive Branches',
        value: inactive,
        helper: 'Planned or paused',
      },
      {
        label: 'Controllers',
        value: assigned,
        helper: 'Assigned branch admins',
      },
    ]
  }, [branches])

  const resetForm = () => {
    setForm({
      branch_name: '',
      location: '',
      branch_controller: 'Not Assigned',
      status: 'active',
    })
    setEditingBranch(null)
  }

  const openCreateModal = () => {
    resetForm()
    setOpen(true)
  }

  const openEditModal = (branch: BranchRow) => {
    setEditingBranch(branch)
    setForm({
      branch_name: branch.branch_name,
      location: branch.location,
      branch_controller: branch.branch_controller,
      status: branch.status,
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    resetForm()
  }

  const handleSave = () => {
    if (!form.branch_name.trim() || !form.location.trim()) return

    const now = new Date().toISOString().slice(0, 10)

    if (editingBranch) {
      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === editingBranch.id
            ? {
                ...branch,
                branch_name: form.branch_name.trim(),
                location: form.location.trim(),
                branch_controller: form.branch_controller,
                status: form.status,
                updated_at: now,
              }
            : branch
        )
      )
    } else {
      const newBranch: BranchRow = {
        id: `BR-${String(branches.length + 1).padStart(3, '0')}`,
        branch_name: form.branch_name.trim(),
        location: form.location.trim(),
        branch_controller: form.branch_controller,
        status: form.status,
        created_at: now,
        updated_at: now,
      }

      setBranches((prev) => [newBranch, ...prev])
    }

    closeModal()
  }

  const handleDelete = (id: string) => {
    setBranches((prev) => prev.filter((branch) => branch.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
              Branch Management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Branches</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Create and manage pixlpluzportal branches. Each branch can have a branch controller,
              location, active/inactive status, and branch-based data scope.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
          >
            Create Branch
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <div className="mt-3 text-3xl font-bold">{item.value}</div>
            <p className="mt-3 text-xs text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 ">
        <div className="border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-bold">Branch List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo table based on the final branches table structure.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Branch ID</th>
                  <th className="px-5 py-3">Branch Name</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Branch Controller</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-4 font-semibold">{branch.id}</td>
                    <td className="px-5 py-4">{branch.branch_name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{branch.location}</td>
                    <td className="px-5 py-4">{branch.branch_controller}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          branch.status === 'active'
                            ? 'bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]'
                            : 'bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground'
                        }
                      >
                        {branch.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{branch.created_at}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(branch)}
                          className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(branch.id)}
                          className="border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {branches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      No branches created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>


      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-bold">
                {editingBranch ? 'Edit Branch' : 'Create Branch'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This is a demo form. Later these fields will save to the real Supabase branches table.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Branch Name</label>
                <input
                  value={form.branch_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, branch_name: event.target.value }))
                  }
                  placeholder="Example: Kochi Branch"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Location</label>
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Example: Kochi, Kerala"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Branch Controller</label>
                <select
                  value={form.branch_controller}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, branch_controller: event.target.value }))
                  }
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  {branchControllers.map((controller) => (
                    <option key={controller} value={controller}>
                      {controller}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as BranchStatus,
                    }))
                  }
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-5">
              <button
                type="button"
                onClick={closeModal}
                className="border border-border px-5 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                {editingBranch ? 'Update Branch' : 'Save Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}