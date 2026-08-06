import { redirect } from 'next/navigation'

/** Real Final QA review lives in Task Submissions. */
export default function FinalQaPage() {
  redirect('/task-submissions')
}
