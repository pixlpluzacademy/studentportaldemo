import { redirect } from 'next/navigation'

/** Admissions UI is hidden for now. Data layer kept for later. */
export default function AdmissionsPage() {
  redirect('/dashboard')
}
