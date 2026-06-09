'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { attendance, batches, courses, students, submissions, tasks } from '@/lib/demo/seed'
import { useDemoAuth } from '@/lib/demo/auth'

type WorkPackage = {
  id: string
  number: string
  title: string
  duration: string
  goal: string
  skills: string[]
  tools: string[]
  practiceTasks: string[]
  finalDeliverable: string
}

type CourseLevel = {
  id: string
  name: string
  color: 'green' | 'yellow' | 'pink'
  summary: string
  packages: WorkPackage[]
}

type CourseDetail = {
  id: string
  name: string
  type: string
  tagline: string
  description: string
  duration: string
  workPackages: number
  portfolioOutputs: number
  passMark: number
  levels: CourseLevel[]
  assignments: string[]
  rubric: { label: string; value: string }[]
  tools: string[]
  outputs: string[]
}

const courseDetails: CourseDetail[] = [
  {
    id: 'co1',
    name: 'Digital Marketing',
    type: 'Professional',
    tagline: 'From zero to campaign-ready in 1 month.',
    description:
      'Master performance marketing, content systems, paid ads, analytics and growth strategy. Build real campaign assets for portfolio and placement readiness.',
    duration: '1 Month',
    workPackages: 11,
    portfolioOutputs: 4,
    passMark: 70,
    levels: [
      {
        id: 'foundation',
        name: 'Foundation',
        color: 'green',
        summary: 'Build your understanding of brand, content, digital channels and customer targeting.',
        packages: [
          {
            id: 'wp-01',
            number: '01',
            title: 'Brand & Market Basics',
            duration: '1 week',
            goal: 'Understand brand positioning, target audience segmentation and competitive landscape analysis.',
            skills: ['Brand positioning', 'Audience segmentation', 'Competitor research', 'Value proposition writing'],
            tools: ['Notion', 'Google Trends', 'Semrush free tier'],
            practiceTasks: [
              'Map two brands in the same niche',
              'Define three audience personas',
              'Write a positioning statement',
            ],
            finalDeliverable: 'Brand strategy one-pager with positioning, personas and value proposition.',
          },
          {
            id: 'wp-02',
            number: '02',
            title: 'Content System',
            duration: '2 weeks',
            goal: 'Create a 30-day content engine for social media, reels, carousels and campaign communication.',
            skills: ['Content planning', 'Caption writing', 'Creative direction', 'Content calendar'],
            tools: ['Canva', 'Meta Business Suite', 'Google Sheets'],
            practiceTasks: [
              'Create 10 content ideas for one brand',
              'Write 5 reel concepts with hooks',
              'Prepare a 30-day content calendar',
            ],
            finalDeliverable: '30-day content calendar with captions, hooks and creative direction.',
          },
        ],
      },
      {
        id: 'intermediate',
        name: 'Intermediate',
        color: 'yellow',
        summary: 'Run paid campaigns, build reporting structure and understand campaign performance.',
        packages: [
          {
            id: 'wp-03',
            number: '03',
            title: 'Paid Ads Fundamentals',
            duration: '2 weeks',
            goal: 'Understand campaign objectives, audience setup, ad structure, budget planning and testing.',
            skills: ['Meta ads', 'Campaign objective', 'Audience testing', 'Ad copy'],
            tools: ['Meta Ads Manager', 'Google Ads', 'Canva'],
            practiceTasks: [
              'Create campaign structures for awareness, leads and conversion',
              'Write 10 ad copy variations',
              'Build an audience testing plan',
            ],
            finalDeliverable: 'Paid ads campaign blueprint with objective, creatives, targeting and budget split.',
          },
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced',
        color: 'pink',
        summary: 'Prepare portfolio-ready campaign systems and final presentation output.',
        packages: [
          {
            id: 'wp-04',
            number: '04',
            title: 'Growth Strategy Sprint',
            duration: '1 week',
            goal: 'Design a 90-day growth strategy using funnel thinking, experiments and campaign planning.',
            skills: ['Funnel strategy', 'Experiment design', 'KPI planning', 'Channel prioritisation'],
            tools: ['Notion', 'Google Sheets', 'Looker Studio'],
            practiceTasks: [
              'Map a funnel for two brands',
              'Design three growth experiments',
              'Create KPI dashboard structure',
            ],
            finalDeliverable: '90-day growth strategy with funnel audit, channel mix, experiment backlog and KPI dashboard.',
          },
        ],
      },
    ],
    assignments: [
      'Brand audit and positioning document',
      '30-day content calendar',
      'Paid ads campaign blueprint',
      'Analytics report and recommendation sheet',
    ],
    rubric: [
      { label: 'Strategy clarity', value: '20%' },
      { label: 'Execution quality', value: '25%' },
      { label: 'Tool usage', value: '20%' },
      { label: 'Final project', value: '25%' },
      { label: 'Presentation', value: '10%' },
    ],
    tools: ['Meta Ads', 'Google Ads', 'GA4', 'Canva', 'Notion', 'Looker Studio', 'Google Sheets'],
    outputs: [
      'Brand strategy one-pager',
      'Content calendar',
      'Paid campaign plan',
      'Final performance marketing portfolio project',
    ],
  },
  {
    id: 'co2',
    name: '3D Visualization',
    type: 'Advanced',
    tagline: 'Build cinematic architectural visuals and portfolio-ready renders.',
    description:
      'Learn modeling, materials, lighting, camera composition and render presentation for architecture and interior visualization.',
    duration: '2 Months',
    workPackages: 10,
    portfolioOutputs: 5,
    passMark: 70,
    levels: [
      {
        id: 'foundation',
        name: 'Foundation',
        color: 'green',
        summary: 'Understand 3D workflow, modeling basics and clean scene setup.',
        packages: [
          {
            id: 'wp-01',
            number: '01',
            title: '3D Scene Setup',
            duration: '1 week',
            goal: 'Understand scene scale, modeling cleanliness and asset organization.',
            skills: ['Scene setup', 'Basic modeling', 'Reference reading', 'Asset organization'],
            tools: ['3ds Max', 'Corona', 'V-Ray'],
            practiceTasks: ['Model basic room shell', 'Create furniture blocks', 'Organize scene layers'],
            finalDeliverable: 'Clean 3D room scene with organized assets.',
          },
        ],
      },
      {
        id: 'intermediate',
        name: 'Intermediate',
        color: 'yellow',
        summary: 'Work with materials, lights and camera angles for realistic output.',
        packages: [
          {
            id: 'wp-02',
            number: '02',
            title: 'Lighting and Materials',
            duration: '3 weeks',
            goal: 'Create realistic materials and balanced lighting for interior scenes.',
            skills: ['Material setup', 'Lighting', 'Camera composition', 'Render testing'],
            tools: ['3ds Max', 'V-Ray', 'Corona', 'Photoshop'],
            practiceTasks: ['Create wood, fabric and metal materials', 'Set daylight lighting', 'Render two camera angles'],
            finalDeliverable: 'Interior render with realistic lighting and material setup.',
          },
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced',
        color: 'pink',
        summary: 'Create final render presentation and portfolio-ready output.',
        packages: [
          {
            id: 'wp-03',
            number: '03',
            title: 'Portfolio Render',
            duration: '2 weeks',
            goal: 'Complete one final render project with post-production and presentation.',
            skills: ['Final rendering', 'Post-production', 'Presentation board', 'Portfolio storytelling'],
            tools: ['3ds Max', 'Corona', 'Photoshop'],
            practiceTasks: ['Render final view', 'Do post-production pass', 'Prepare presentation sheet'],
            finalDeliverable: 'Final portfolio-ready architectural visualization project.',
          },
        ],
      },
    ],
    assignments: ['Bedroom interior render', 'Material study board', 'Lighting comparison render', 'Final portfolio render'],
    rubric: [
      { label: 'Modeling quality', value: '25%' },
      { label: 'Lighting', value: '20%' },
      { label: 'Materials', value: '20%' },
      { label: 'Composition', value: '20%' },
      { label: 'Presentation', value: '15%' },
    ],
    tools: ['3ds Max', 'V-Ray', 'Corona', 'Photoshop'],
    outputs: ['Interior render', 'Material board', 'Lighting study', 'Portfolio presentation'],
  },
  {
    id: 'co3',
    name: 'Website Development',
    type: 'Basic + Internship',
    tagline: 'Build modern websites with real project workflow.',
    description:
      'Learn frontend foundations, responsive layout, Next.js structure, Supabase basics and deployment-ready project workflow.',
    duration: '4 Months',
    workPackages: 12,
    portfolioOutputs: 6,
    passMark: 70,
    levels: [
      {
        id: 'foundation',
        name: 'Foundation',
        color: 'green',
        summary: 'Learn HTML, CSS, layout logic and responsive web basics.',
        packages: [
          {
            id: 'wp-01',
            number: '01',
            title: 'Frontend Basics',
            duration: '3 weeks',
            goal: 'Understand structure, layout, typography and responsive design.',
            skills: ['HTML', 'CSS', 'Responsive layout', 'Page structure'],
            tools: ['VS Code', 'Chrome DevTools', 'Figma'],
            practiceTasks: ['Create landing page hero', 'Build card grid', 'Make responsive layout'],
            finalDeliverable: 'Responsive landing page section.',
          },
        ],
      },
      {
        id: 'intermediate',
        name: 'Intermediate',
        color: 'yellow',
        summary: 'Build reusable UI and understand Next.js app structure.',
        packages: [
          {
            id: 'wp-02',
            number: '02',
            title: 'Next.js UI Development',
            duration: '4 weeks',
            goal: 'Build reusable components and route-based pages.',
            skills: ['Next.js App Router', 'Components', 'Props', 'Tailwind'],
            tools: ['Next.js', 'Tailwind', 'TypeScript'],
            practiceTasks: ['Create dashboard cards', 'Build listing table', 'Create detail page'],
            finalDeliverable: 'Mini dashboard app with listing and detail page.',
          },
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced',
        color: 'pink',
        summary: 'Connect database, authentication and deployment workflow.',
        packages: [
          {
            id: 'wp-03',
            number: '03',
            title: 'Supabase and Deployment',
            duration: '4 weeks',
            goal: 'Connect real backend, authentication and deploy the application.',
            skills: ['Supabase', 'Authentication', 'Database integration', 'Vercel deployment'],
            tools: ['Supabase', 'PostgreSQL', 'Vercel'],
            practiceTasks: ['Create Supabase table', 'Connect data to page', 'Deploy project to Vercel'],
            finalDeliverable: 'Deployed full-stack demo project.',
          },
        ],
      },
    ],
    assignments: ['Portfolio landing page', 'Dashboard UI', 'Supabase connected table', 'Final deployed website'],
    rubric: [
      { label: 'Code structure', value: '25%' },
      { label: 'Responsive design', value: '20%' },
      { label: 'Backend connection', value: '20%' },
      { label: 'UI quality', value: '20%' },
      { label: 'Deployment', value: '15%' },
    ],
    tools: ['Next.js', 'TypeScript', 'Tailwind', 'Supabase', 'Vercel'],
    outputs: ['Portfolio page', 'Dashboard UI', 'Full-stack demo', 'Deployed website'],
  },
]

const tabs = ['Overview', 'Syllabus', 'Tasks', 'Attendance', 'Marks', 'Tools', 'Portfolio Outputs']

function levelStyle(color: CourseLevel['color']) {
  if (color === 'green') return 'border-[#6ee75a] text-[#6ee75a] bg-[#6ee75a]/10'
  if (color === 'yellow') return 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
  return 'border-pink-500 text-pink-500 bg-pink-500/10'
}

function levelBorder(color: CourseLevel['color']) {
  if (color === 'green') return 'border-[#6ee75a]'
  if (color === 'yellow') return 'border-yellow-500'
  return 'border-pink-500'
}

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('active') || value.includes('open') || value.includes('marked')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('review') || value.includes('pending')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('approved') || value.includes('passed')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return 'border-border bg-background text-foreground'
}

function getGrade(score: number) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export default function Page() {
  const params = useParams()
  const { role, user } = useDemoAuth()
  const [activeTab, setActiveTab] = useState('Overview')
  const [openPackage, setOpenPackage] = useState('')

  const courseId = String(params?.id || '')
  const course = courseDetails.find((item) => item.id === courseId) || courseDetails[0]
  const seedCourse = courses.find((item) => item.id === course.id || item.name === course.name)

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor' || role?.id === 'mentor'

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const relatedBatches = useMemo(() => {
    const courseBatches = batches.filter((batch) => batch.course === course.name)

    if (isStudent) {
      return courseBatches.filter((batch) => batch.name === currentStudent?.batch)
    }

    if (ismentor && user?.fullName) {
      return courseBatches.filter((batch) => batch.mentor === user.fullName)
    }

    return courseBatches
  }, [course.name, currentStudent?.batch, isStudent, ismentor, user?.fullName])

  const relatedStudents = useMemo(() => {
    return students.filter((student) => student.course === course.name && relatedBatches.some((batch) => batch.name === student.batch))
  }, [course.name, relatedBatches])

  const relatedTasks = useMemo(() => {
    return tasks.filter((task) => task.course === course.name && relatedBatches.some((batch) => batch.name === task.batch))
  }, [course.name, relatedBatches])

  const relatedSubmissions = useMemo(() => {
    return submissions.filter((submission) => relatedTasks.some((task) => task.title === submission.task))
  }, [relatedTasks])

  const relatedAttendance = useMemo(() => {
    return attendance.filter((item) => relatedBatches.some((batch) => batch.name === item.batch))
  }, [relatedBatches])

  const averageAttendance =
    relatedStudents.length > 0
      ? `${Math.round(
          relatedStudents.reduce((total, student) => total + Number(String(student.attendance).replace('%', '')), 0) /
            relatedStudents.length,
        )}%`
      : '0%'

  const completedSubmissions = relatedSubmissions.length
  const courseProgress = relatedTasks.length > 0 ? Math.min(100, Math.round((completedSubmissions / relatedTasks.length) * 100)) : 0

  const averageScore =
    relatedSubmissions.length > 0
      ? Math.round(
          relatedSubmissions.reduce((total, submission) => {
            const value = Number(submission.mentorScore)
            return total + (Number.isNaN(value) ? 0 : value)
          }, 0) / relatedSubmissions.length,
        )
      : 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <Link href="/my-courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← My Courses
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link href="/tasks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            View Tasks
          </Link>
          <Link
            href="/task-submissions"
            className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black"
          >
            View Submissions
          </Link>
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center bg-[#153e90]/10 text-xl font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
            {course.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{course.type}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{course.name}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{course.tagline}</p>
            <p className="mt-4 max-w-4xl leading-7 text-muted-foreground">{course.description}</p>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="mt-1 text-lg font-bold">{course.duration}</p>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Work Packages</p>
                <p className="mt-1 text-lg font-bold">{course.workPackages}</p>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio Outputs</p>
                <p className="mt-1 text-lg font-bold">{course.portfolioOutputs}</p>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pass Mark</p>
                <p className="mt-1 text-lg font-bold">{course.passMark}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{courseProgress}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Course Progress</div>
          <div className="mt-3 h-2 bg-muted">
            <div className="h-2 bg-[#153e90] dark:bg-[#6ee75a]" style={{ width: `${courseProgress}%` }} />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageAttendance}</div>
          <div className="mt-1 text-sm text-muted-foreground">Attendance</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Batch average</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{relatedTasks.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assigned Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{relatedSubmissions.length} submissions</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageScore || '-'}</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Mark</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
            {averageScore ? `Grade ${getGrade(averageScore)}` : 'No marks yet'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-border bg-card">
        <div className="flex min-w-[900px]">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? 'border-b-2 border-[#153e90] px-5 py-4 text-sm font-semibold text-[#153e90] dark:border-[#6ee75a] dark:text-[#6ee75a]'
                  : 'border-b-2 border-transparent px-5 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground'
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="border border-border bg-card p-6">
              <h2 className="text-xl font-bold">Course Overview</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                This page is focused on the learner and mentor view. Students can understand what they are learning,
                what tasks are pending, how attendance is performing and how their marks are progressing.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {relatedBatches.map((batch) => (
                  <div key={batch.id} className="border border-border bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{batch.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{batch.mode} · {batch.time}</p>
                      </div>
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mentor</span>
                        <span className="font-semibold">{batch.mentor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seats</span>
                        <span className="font-semibold">{batch.seats}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <h2 className="text-xl font-bold">Learning Summary</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Link href="/tasks" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{relatedTasks.length}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Tasks Assigned</div>
                </Link>
                <Link href="/task-submissions" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{relatedSubmissions.length}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Submissions</div>
                </Link>
                <Link href="/marks" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{averageScore || '-'}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Current Mark</div>
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Role View</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {isStudent
                  ? 'You are viewing the course connected to your batch.'
                  : ismentor
                    ? 'You are viewing course details connected to your assigned batches.'
                    : 'Management can view connected batches, students, tasks and progress.'}
              </p>
            </div>

            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Course Tools</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {(seedCourse?.tools || course.tools.join(', ')).split(',').map((tool) => (
                  <span key={tool.trim()} className="border border-border bg-background px-3 py-1 text-xs font-semibold">
                    {tool.trim()}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'Syllabus' && (
        <div className="space-y-5">
          {course.levels.map((level) => (
            <div key={level.id} className={`border bg-card p-5 ${levelBorder(level.color)}`}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <span className={`inline-flex border px-3 py-1 text-xs font-semibold ${levelStyle(level.color)}`}>
                    {level.name}
                  </span>
                  <h2 className="mt-3 text-xl font-bold">{level.name} Level</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{level.summary}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {level.packages.map((pkg) => (
                  <div key={pkg.id} className="border border-border bg-background/60">
                    <button
                      type="button"
                      onClick={() => setOpenPackage(openPackage === pkg.id ? '' : pkg.id)}
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[#153e90] dark:text-[#6ee75a]">Package {pkg.number}</div>
                        <div className="mt-1 font-bold">{pkg.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{pkg.duration}</div>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {openPackage === pkg.id ? 'Close' : 'View'}
                      </span>
                    </button>

                    {openPackage === pkg.id && (
                      <div className="border-t border-border p-4">
                        <p className="text-sm leading-6 text-muted-foreground">{pkg.goal}</p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-bold">Skills</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {pkg.skills.map((skill) => (
                                <span key={skill} className="border border-border bg-card px-3 py-1 text-xs font-semibold">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold">Tools</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {pkg.tools.map((tool) => (
                                <span key={tool} className="border border-border bg-card px-3 py-1 text-xs font-semibold">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h4 className="text-sm font-bold">Practice Tasks</h4>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {pkg.practiceTasks.map((task) => (
                              <li key={task} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                                {task}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 p-4 text-sm text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white">
                          Final Deliverable: {pkg.finalDeliverable}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Tasks' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Course Tasks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tasks assigned to the connected batch.</p>
            </div>
            <Link href="/tasks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Tasks Page
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Assigned By</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Submissions</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {relatedTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border">
                    <td className="px-4 py-4 font-semibold">{task.title}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.batch}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.assignedBy}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.due}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.submissions}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {relatedTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No tasks found for this course.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Attendance' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Attendance Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">Attendance connected to this course batch.</p>
            </div>
            <Link href="/attendance" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Attendance
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {relatedAttendance.map((item) => (
              <div key={item.id} className="border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{item.session}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.date} · {item.batch}</p>
                  </div>
                  <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.present}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.absent}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.late}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Late</div>
                  </div>
                </div>
              </div>
            ))}

            {relatedAttendance.length === 0 && (
              <div className="border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground md:col-span-2">
                No attendance records found for this course.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Marks' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Marks Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">Marks are connected with task submissions.</p>
            </div>
            <Link href="/marks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Marks
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {!isStudent && <th className="px-4 py-3 font-semibold">Student</th>}
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                  <th className="px-4 py-3 font-semibold">HOD</th>
                  <th className="px-4 py-3 font-semibold">Final QA</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {relatedSubmissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-border">
                    {!isStudent && <td className="px-4 py-4 font-semibold">{submission.student}</td>}
                    <td className="px-4 py-4 text-muted-foreground">{submission.task}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.mentorScore}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.hodStatus}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.qaStatus}</td>
                    <td className="px-4 py-4">
                      <Link href={`/task-submissions/${submission.id}`} className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}

                {relatedSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={isStudent ? 5 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No marks found for this course.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Tools' && (
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Tools Covered</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {course.tools.map((tool) => (
              <span key={tool} className="border border-border bg-background px-4 py-2 text-sm font-semibold">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Portfolio Outputs' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Portfolio Outputs</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {course.outputs.map((output) => (
                <li key={output} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                  {output}
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Marking Criteria</h2>
            <div className="mt-4 space-y-3">
              {course.rubric.map((item) => (
                <div key={item.label} className="flex items-center justify-between border border-border bg-background/60 p-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}