import { redirect } from 'next/navigation'

/** Real HOD review lives in Task Submissions. */
export default function HodReviewPage() {
  redirect('/task-submissions')
}
