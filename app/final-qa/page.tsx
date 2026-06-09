import { DemoModulePage } from '@/components/demo/demo-module-page'
import { companies, branches, courses, batches, students, mentors, attendance, tasks, submissions, placements, certificates, complaints, defaultUsers } from '@/lib/demo/seed'

export default function Page() {
  return (
    <DemoModulePage
      moduleId='final_qa'
      title='Final QA'
      subtitle='Final validation and score locking before certificate eligibility.'
      stats={[{ label: 'QA Pending', value: '1', helper: 'Ready to validate' },{ label: 'Locked', value: '0', helper: 'Final completed' },{ label: 'Validated', value: '1', helper: 'Approved by QA' },{ label: 'Certificates Pending', value: '1', helper: 'After lock' }]}
      columns={['student', 'task', 'mentor', 'mentorScore', 'hodStatus', 'qaStatus', 'status']}
      rows={submissions}
      actions={[{ label: 'Validate', action: 'validate' },{ label: 'Lock Final Score', action: 'lock' },{ label: 'Approve', action: 'approve' },{ label: 'Export', action: 'export' }]}
      createLabel={undefined}
      focusTitle='Final QA Validation'
      focusItems={['Final QA validates HOD-approved submissions.', 'Final lock prevents score changes.', 'Certificate issue depends on final completion.']}
    />
  )
}
