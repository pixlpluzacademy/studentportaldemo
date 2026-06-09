import { DemoModulePage } from '@/components/demo/demo-module-page'
import { companies, branches, courses, batches, students, mentors, attendance, tasks, submissions, placements, certificates, complaints, defaultUsers } from '@/lib/demo/seed'

export default function Page() {
  return (
    <DemoModulePage
      moduleId='companies'
      title='Companies'
      subtitle='Manage company-level structures before branches and users are created.'
      stats={[{ label: 'Companies', value: '2', helper: 'Multi-company ready' },{ label: 'Branches', value: '3', helper: 'Across India and UAE' },{ label: 'Admins', value: '2', helper: 'Company-level control' },{ label: 'Status', value: 'Demo', helper: 'Local state only' }]}
      columns={['name', 'location', 'branches', 'status']}
      rows={companies}
      actions={[{ label: 'Create', action: 'create' },{ label: 'Edit', action: 'edit' },{ label: 'Delete', action: 'delete' },{ label: 'Export', action: 'export' }]}
      createLabel={'Create Company'}
      focusTitle='Company Directory'
      focusItems={['Super Admin can create companies.', 'Admins can work only inside assigned company scope.', 'Future expansion can add more companies without changing portal logic.']}
    />
  )
}
