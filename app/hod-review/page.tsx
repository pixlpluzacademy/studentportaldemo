import { DemoModulePage } from '@/components/demo/demo-module-page'
import { companies, branches, courses, batches, students, mentors, attendance, tasks, submissions, placements, certificates, complaints, defaultUsers } from '@/lib/demo/seed'

export default function Page() {
  return (
    <DemoModulePage
      moduleId='hod_review'
      title='HOD Review'
      subtitle='Superior mentor review and approvals for mentor-scored submissions.'
      stats={[{ label: 'Pending HOD Review', value: '1', helper: 'Needs review' },{ label: 'Approved', value: '1', helper: 'Ready for QA' },{ label: 'Revision Requested', value: '0', helper: 'No blockers' },{ label: 'Mentors Monitored', value: '3', helper: 'Assigned mentors' }]}
      columns={['student', 'task', 'mentor', 'mentorScore', 'hodStatus', 'qaStatus', 'status']}
      rows={submissions}
      actions={[{ label: 'Review', action: 'review' },{ label: 'Approve', action: 'approve' },{ label: 'Edit Review', action: 'edit' },{ label: 'Export', action: 'export' }]}
      createLabel={undefined}
      focusTitle='HOD Review Queue'
      focusItems={['HOD reviews mentor evaluation quality.', 'HOD can approve or request revision.', 'Only assigned branch or mentor records should appear.']}
    />
  )
}
