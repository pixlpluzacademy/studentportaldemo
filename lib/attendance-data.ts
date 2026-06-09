import type { ClassSession, AttendanceRecord, AttendanceStatus } from './types'

// ─── Sessions (2 per week × 3 weeks = 6 per cohort) ─────────────────────────

export const mockSessions: ClassSession[] = [
  // Cohort 1 – Winter 2024
  { id: 'ses-c1-1', cohortId: 'cohort-1', title: 'Week 1 – Monday Session', date: '2024-02-05', startTime: '09:00', endTime: '13:00', topic: 'Orientation & Tool Setup', mentorId: 'mentor-1', location: 'pixlpluzportal Kochi Campus – Room A' },
  { id: 'ses-c1-2', cohortId: 'cohort-1', title: 'Week 1 – Thursday Session', date: '2024-02-08', startTime: '09:00', endTime: '13:00', topic: 'Foundations Deep Dive', mentorId: 'mentor-1', location: 'pixlpluzportal Kochi Campus – Room A' },
  { id: 'ses-c1-3', cohortId: 'cohort-1', title: 'Week 2 – Monday Session', date: '2024-02-12', startTime: '09:00', endTime: '13:00', topic: 'Intermediate Concepts', mentorId: 'mentor-2', location: 'pixlpluzportal Kochi Campus – Room A' },
  { id: 'ses-c1-4', cohortId: 'cohort-1', title: 'Week 2 – Thursday Session', date: '2024-02-15', startTime: '09:00', endTime: '13:00', topic: 'Project Kickoff', mentorId: 'mentor-2', location: 'pixlpluzportal Kochi Campus – Room A' },
  { id: 'ses-c1-5', cohortId: 'cohort-1', title: 'Week 3 – Monday Session', date: '2024-02-19', startTime: '09:00', endTime: '13:00', topic: 'Advanced Patterns', mentorId: 'mentor-1', location: 'pixlpluzportal Kochi Campus – Room A' },
  { id: 'ses-c1-6', cohortId: 'cohort-1', title: 'Week 3 – Thursday Session', date: '2024-02-22', startTime: '09:00', endTime: '13:00', topic: 'Peer Review & Feedback', mentorId: 'mentor-1', location: 'pixlpluzportal Kochi Campus – Room A' },

  // Cohort 2 – Spring 2024
  { id: 'ses-c2-1', cohortId: 'cohort-2', title: 'Week 1 – Monday Session', date: '2024-03-04', startTime: '09:00', endTime: '13:00', topic: 'Orientation & Tool Setup', mentorId: 'mentor-3', location: 'pixlpluzportal Kochi Campus – Room B' },
  { id: 'ses-c2-2', cohortId: 'cohort-2', title: 'Week 1 – Thursday Session', date: '2024-03-07', startTime: '09:00', endTime: '13:00', topic: 'Foundations Deep Dive', mentorId: 'mentor-3', location: 'pixlpluzportal Kochi Campus – Room B' },
  { id: 'ses-c2-3', cohortId: 'cohort-2', title: 'Week 2 – Monday Session', date: '2024-03-11', startTime: '09:00', endTime: '13:00', topic: 'Intermediate Concepts', mentorId: 'mentor-4', location: 'pixlpluzportal Kochi Campus – Room B' },
  { id: 'ses-c2-4', cohortId: 'cohort-2', title: 'Week 2 – Thursday Session', date: '2024-03-14', startTime: '09:00', endTime: '13:00', topic: 'Project Kickoff', mentorId: 'mentor-4', location: 'pixlpluzportal Kochi Campus – Room B' },
  { id: 'ses-c2-5', cohortId: 'cohort-2', title: 'Week 3 – Monday Session', date: '2024-03-18', startTime: '09:00', endTime: '13:00', topic: 'Advanced Patterns', mentorId: 'mentor-3', location: 'pixlpluzportal Kochi Campus – Room B' },
  { id: 'ses-c2-6', cohortId: 'cohort-2', title: 'Week 3 – Thursday Session', date: '2024-03-21', startTime: '09:00', endTime: '13:00', topic: 'Peer Review & Feedback', mentorId: 'mentor-3', location: 'pixlpluzportal Kochi Campus – Room B' },

  // Cohort 3 – Summer 2024
  { id: 'ses-c3-1', cohortId: 'cohort-3', title: 'Week 1 – Monday Session', date: '2024-04-01', startTime: '09:00', endTime: '13:00', topic: 'Orientation & Tool Setup', mentorId: 'mentor-5', location: 'pixlpluzportal Kochi Campus – Room C' },
  { id: 'ses-c3-2', cohortId: 'cohort-3', title: 'Week 1 – Thursday Session', date: '2024-04-04', startTime: '09:00', endTime: '13:00', topic: 'Foundations Deep Dive', mentorId: 'mentor-5', location: 'pixlpluzportal Kochi Campus – Room C' },
  { id: 'ses-c3-3', cohortId: 'cohort-3', title: 'Week 2 – Monday Session', date: '2024-04-08', startTime: '09:00', endTime: '13:00', topic: 'Intermediate Concepts', mentorId: 'mentor-6', location: 'pixlpluzportal Kochi Campus – Room C' },
  { id: 'ses-c3-4', cohortId: 'cohort-3', title: 'Week 2 – Thursday Session', date: '2024-04-11', startTime: '09:00', endTime: '13:00', topic: 'Project Kickoff', mentorId: 'mentor-6', location: 'pixlpluzportal Kochi Campus – Room C' },
  { id: 'ses-c3-5', cohortId: 'cohort-3', title: 'Week 3 – Monday Session', date: '2024-04-15', startTime: '09:00', endTime: '13:00', topic: 'Advanced Patterns', mentorId: 'mentor-5', location: 'pixlpluzportal Kochi Campus – Room C' },
  { id: 'ses-c3-6', cohortId: 'cohort-3', title: 'Week 3 – Thursday Session', date: '2024-04-18', startTime: '09:00', endTime: '13:00', topic: 'Peer Review & Feedback', mentorId: 'mentor-5', location: 'pixlpluzportal Kochi Campus – Room C' },
]

// ─── Helper ──────────────────────────────────────────────────────────────────

type StudentAttendancePlan = Record<string, AttendanceStatus>

function makeRecords(
  sessionIds: string[],
  cohortId: string,
  studentId: string,
  plan: AttendanceStatus[], // one status per session in order
  mentorId: string,
  dates: string[],
): AttendanceRecord[] {
  return sessionIds.map((sessionId, i) => ({
    id: `att-${cohortId}-${studentId}-${i + 1}`,
    sessionId,
    studentId,
    cohortId,
    date: dates[i],
    status: plan[i],
    markedBy: mentorId,
    markedAt: `${dates[i]}T09:05:00Z`,
    note: plan[i] === 'absent' ? 'No notice received' : plan[i] === 'late' ? 'Arrived 20 min late' : undefined,
  }))
}

// ─── Cohort 1 sessions ───────────────────────────────────────────────────────
const c1Ids = ['ses-c1-1', 'ses-c1-2', 'ses-c1-3', 'ses-c1-4', 'ses-c1-5', 'ses-c1-6']
const c1Dates = ['2024-02-05', '2024-02-08', '2024-02-12', '2024-02-15', '2024-02-19', '2024-02-22']
const c1Mentor = 'mentor-1'

// ─── Cohort 2 sessions ───────────────────────────────────────────────────────
const c2Ids = ['ses-c2-1', 'ses-c2-2', 'ses-c2-3', 'ses-c2-4', 'ses-c2-5', 'ses-c2-6']
const c2Dates = ['2024-03-04', '2024-03-07', '2024-03-11', '2024-03-14', '2024-03-18', '2024-03-21']
const c2Mentor = 'mentor-3'

// ─── Cohort 3 sessions ───────────────────────────────────────────────────────
const c3Ids = ['ses-c3-1', 'ses-c3-2', 'ses-c3-3', 'ses-c3-4', 'ses-c3-5', 'ses-c3-6']
const c3Dates = ['2024-04-01', '2024-04-04', '2024-04-08', '2024-04-11', '2024-04-15', '2024-04-18']
const c3Mentor = 'mentor-5'

// Attendance plans per student (Present=P, Late=L, Absent=A)
//   P P P P P P  → 100%  (6/6)
//   P P P P P L  → 92%   (5.5/6 treated as present)
//   P A P P P P  → 83%
//   P L P A P P  → 75% — warning threshold
//   P A P A P P  → 67%  — below threshold
//   A A P P P P  → 67%
type S = AttendanceStatus
const P: S = 'present', L: S = 'late', A: S = 'absent'

export const mockAttendanceRecords: AttendanceRecord[] = [
  // ── Cohort 1 (students 1–8) ──
  ...makeRecords(c1Ids, 'cohort-1', 'student-1', [P, P, P, P, P, P], c1Mentor, c1Dates),  // 100%
  ...makeRecords(c1Ids, 'cohort-1', 'student-2', [P, P, P, P, P, L], c1Mentor, c1Dates),  // 5/6
  ...makeRecords(c1Ids, 'cohort-1', 'student-3', [P, A, P, P, P, P], c1Mentor, c1Dates),  // 5/6
  ...makeRecords(c1Ids, 'cohort-1', 'student-4', [P, L, P, A, P, P], c1Mentor, c1Dates),  // 4/6 — at threshold
  ...makeRecords(c1Ids, 'cohort-1', 'student-5', [P, A, P, A, P, P], c1Mentor, c1Dates),  // 4/6
  ...makeRecords(c1Ids, 'cohort-1', 'student-6', [P, P, A, A, P, P], c1Mentor, c1Dates),  // 4/6
  ...makeRecords(c1Ids, 'cohort-1', 'student-7', [A, A, P, P, P, P], c1Mentor, c1Dates),  // 4/6
  ...makeRecords(c1Ids, 'cohort-1', 'student-8', [A, A, A, P, P, P], c1Mentor, c1Dates),  // 3/6 — below

  // ── Cohort 2 (students 9–16) ──
  ...makeRecords(c2Ids, 'cohort-2', 'student-9',  [P, P, P, P, P, P], c2Mentor, c2Dates), // 100%
  ...makeRecords(c2Ids, 'cohort-2', 'student-10', [P, P, P, P, L, P], c2Mentor, c2Dates), // 5/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-11', [P, P, A, P, P, P], c2Mentor, c2Dates), // 5/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-12', [P, P, P, A, P, P], c2Mentor, c2Dates), // 5/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-13', [P, L, P, P, A, P], c2Mentor, c2Dates), // 4/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-14', [A, P, P, P, P, P], c2Mentor, c2Dates), // 5/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-15', [P, A, A, P, P, P], c2Mentor, c2Dates), // 4/6
  ...makeRecords(c2Ids, 'cohort-2', 'student-16', [A, A, P, P, P, L], c2Mentor, c2Dates), // 3/6 — below

  // ── Cohort 3 (students 17–24) ──
  ...makeRecords(c3Ids, 'cohort-3', 'student-17', [P, P, P, P, P, P], c3Mentor, c3Dates), // 100%
  ...makeRecords(c3Ids, 'cohort-3', 'student-18', [P, P, P, P, P, L], c3Mentor, c3Dates), // 5/6
  ...makeRecords(c3Ids, 'cohort-3', 'student-19', [P, P, P, P, A, P], c3Mentor, c3Dates), // 5/6
  ...makeRecords(c3Ids, 'cohort-3', 'student-20', [P, L, P, P, P, P], c3Mentor, c3Dates), // 5/6
  ...makeRecords(c3Ids, 'cohort-3', 'student-21', [P, P, A, P, P, P], c3Mentor, c3Dates), // 5/6
  ...makeRecords(c3Ids, 'cohort-3', 'student-22', [A, P, P, P, P, P], c3Mentor, c3Dates), // 5/6
  ...makeRecords(c3Ids, 'cohort-3', 'student-23', [P, A, P, A, P, P], c3Mentor, c3Dates), // 4/6 — threshold
  ...makeRecords(c3Ids, 'cohort-3', 'student-24', [A, A, P, P, A, P], c3Mentor, c3Dates), // 3/6 — below
]

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Returns attendance % (0–100) for a student across a given set of records */
export function getAttendanceRate(studentId: string, records: AttendanceRecord[]): number {
  const studentRecords = records.filter(r => r.studentId === studentId)
  if (studentRecords.length === 0) return 0
  const attended = studentRecords.filter(r => r.status === 'present' || r.status === 'late').length
  return Math.round((attended / studentRecords.length) * 100)
}

/** Returns the current streak of consecutive attended sessions (present or late) for a student */
export function getAttendanceStreak(studentId: string, records: AttendanceRecord[]): number {
  const studentRecords = records
    .filter(r => r.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date)) // most recent first

  let streak = 0
  for (const r of studentRecords) {
    if (r.status === 'present' || r.status === 'late') {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** Returns records for current month only */
export function getMonthlyRecords(studentId: string, records: AttendanceRecord[], year: number, month: number): AttendanceRecord[] {
  return records.filter(r => {
    const d = new Date(r.date)
    return r.studentId === studentId && d.getFullYear() === year && d.getMonth() === month
  })
}

/** Eligibility: both attendance and academic thresholds must be met */
export function getInternshipEligibility(attendanceRate: number, academicScore: number): {
  eligible: boolean
  attendanceOk: boolean
  academicOk: boolean
} {
  const attendanceOk = attendanceRate >= 75
  const academicOk = academicScore >= 70
  return { eligible: attendanceOk && academicOk, attendanceOk, academicOk }
}
