'use client'

import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  createDepartmentRecord,
  deleteDepartmentRecord,
  updateDepartmentRecord,
  type DepartmentFormInput,
  type DepartmentListRow,
  type DepartmentUiStatus,
} from '@/lib/data/departments'
import { useDepartmentList } from '@/lib/data/hooks/use-departments'

export default function DepartmentsPage() {
  const { can } = useDemoAuth()
  const { departments, activeBranch, activeBranchId, loading, error, reload } = useDepartmentList()

  const [open, setOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<DepartmentListRow | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<DepartmentFormInput>({
    name: '',
    department_code: '',
    description: '',
    status: 'active',
  })

  const canView = can('departments.view')
  const canCreate = can('departments.create')
  const canEdit = can('departments.edit')
  const canDelete = can('departments.delete')

  const stats = useMemo(() => {
    const active = departments.filter((department) => department.status === 'active').length
    const inactive = departments.filter((department) => department.status === 'inactive').length

    return [
      { label: 'Total Departments', value: departments.length, helper: 'In Selected Branch' },
      { label: 'Active Departments', value: active, helper: 'Currently Active' },
      { label: 'Inactive Departments', value: inactive, helper: 'Paused Departments' },
    ]
  }, [departments])

  const resetForm = () => {
    setForm({
      name: '',
      department_code: '',
      description: '',
      status: 'active',
    })
    setEditingDepartment(null)
  }

  const openCreateModal = () => {
    resetForm()
    setOpen(true)
  }

  const openEditModal = (department: DepartmentListRow) => {
    setEditingDepartment(department)
    setForm({
      name: department.name,
      department_code: department.department_code || '',
      description: department.description === '—' ? '' : department.description,
      status: department.status,
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNotice('Department name is required.')
      return
    }

    if (!form.department_code.trim()) {
      setNotice('Department code is required.')
      return
    }

    if (!activeBranchId) {
      setNotice('Select a branch from the header before saving a department.')
      return
    }

    setNotice('')
    setSaving(true)

    try {
      if (editingDepartment) {
        if (!canEdit) {
          setNotice('You do not have permission to edit departments.')
          return
        }

        const result = await updateDepartmentRecord(
          editingDepartment.id,
          form,
          editingDepartment.branch_id || activeBranchId,
        )

        if (!result.ok) {
          setNotice(result.error)
          return
        }

        setNotice('Department updated successfully.')
        closeModal()
        await reload()
        return
      }

      if (!canCreate) {
        setNotice('You do not have permission to create departments.')
        return
      }

      const result = await createDepartmentRecord(form, activeBranchId)

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setNotice('Department created successfully.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      setNotice('You do not have permission to delete departments.')
      return
    }

    setNotice('')
    setSaving(true)

    try {
      const result = await deleteDepartmentRecord(id)

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setNotice('Department deleted successfully.')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  if (!canView) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Departments Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current role cannot view departments.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
              Department Management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Departments</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Create and manage departments for the selected branch
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Branch:{' '}
              <span className="font-semibold text-foreground">
                {activeBranch?.name || 'Select a branch in the header'}
              </span>
            </p>

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            {notice && <p className="mt-2 text-sm text-[#153e90] dark:text-[#6ee75a]">{notice}</p>}
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!activeBranchId}
              className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#153e90]/90 disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
            >
              Create Department
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <div className="mt-3 text-3xl font-bold">{item.value}</div>
            <p className="mt-3 text-xs text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5">
        <div className="border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-bold">Department List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Departments for {activeBranch?.name || 'the selected branch'}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Department Name</th>
                  <th className="px-5 py-3">Department Code</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      Loading departments…
                    </td>
                  </tr>
                )}

                {!loading &&
                  departments.map((department) => (
                    <tr key={department.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-4 font-semibold">{department.name}</td>
                      <td className="px-5 py-4 font-semibold">
                        {department.department_code || '—'}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{activeBranch?.name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{department.description}</td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            department.status === 'active'
                              ? 'bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]'
                              : 'bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground'
                          }
                        >
                          {department.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{department.created_at}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(department)}
                              className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                            >
                              Edit
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleDelete(department.id)}
                              className="border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && !activeBranchId && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      Select a branch from the header to view departments.
                    </td>
                  </tr>
                )}

                {!loading && activeBranchId && departments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No departments created yet.
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
                {editingDepartment ? 'Edit Department' : 'Create Department'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Changes are saved to Supabase.</p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Department Name</label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Example: Digital Marketing"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Department Code</label>
                <input
                  value={form.department_code}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      department_code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: DM"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as DepartmentUiStatus,
                    }))
                  }
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Type department description"
                  rows={4}
                  className="w-full resize-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
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
                disabled={saving}
                onClick={() => void handleSave()}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                {saving
                  ? 'Saving…'
                  : editingDepartment
                    ? 'Update Department'
                    : 'Save Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}