import { DemoModulePage } from '@/components/demo/demo-module-page'
import { companies, branches, courses, batches, students, mentors, attendance, tasks, submissions, placements, certificates, complaints, defaultUsers } from '@/lib/demo/seed'

export default function Page() {
  return (
    <DemoModulePage
      moduleId='marks'
      title='Marks / Evaluation'
      subtitle='Mentor scores, HOD scores, QA scores and final score preparation.'
      stats={[{ label: 'Evaluations', value: '3', helper: 'Active records' },{ label: 'Uploaded Marks', value: '2', helper: 'Mentor completed' },{ label: 'HOD Approved', value: '1', helper: 'Quality check' },{ label: 'Final Pending', value: '2', helper: 'QA lock needed' }]}
      columns={['student', 'task', 'mentor', 'status', 'mentorScore', 'hodStatus', 'qaStatus']}
      rows={submissions}
      actions={[{ label: 'Upload Marks', action: 'upload' },{ label: 'Edit Marks', action: 'edit' },{ label: 'Approve', action: 'approve' },{ label: 'Export', action: 'export' }]}
      createLabel={'Upload Marks'}
      focusTitle='Evaluation Table'
      focusItems={['mentors upload mentor score.', 'HOD can adjust or approve review score.', 'Final QA locks final score after validation.']}
    />
  )
}
