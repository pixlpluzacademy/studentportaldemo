'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

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

const courseDetails = [
  {
    id: 'CRS-001',
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
        summary:
          'Build your understanding of brand, content, digital channels and customer targeting.',
        packages: [
          {
            id: 'wp-01',
            number: '01',
            title: 'Brand & Market Basics',
            duration: '1 week',
            goal:
              'Understand brand positioning, target audience segmentation and competitive landscape analysis.',
            skills: ['Brand positioning', 'Audience segmentation', 'Competitor research', 'Value proposition writing'],
            tools: ['Notion', 'Google Trends', 'Semrush free tier'],
            practiceTasks: [
              'Pick 2 brands in the same niche and map their positioning',
              'Define 3 audience personas with pain points and buying triggers',
              'Write a positioning statement using the PAS framework',
            ],
            finalDeliverable:
              'Brand Strategy One-Pager: positioning, target personas, unique value proposition, and competitive differentiation.',
          },
          {
            id: 'wp-02',
            number: '02',
            title: 'Content System',
            duration: '2 weeks',
            goal:
              'Create a 30-day content engine for social media, reels, carousels and campaign communication.',
            skills: ['Content planning', 'Caption writing', 'Creative direction', 'Content calendar'],
            tools: ['Canva', 'Meta Business Suite', 'Google Sheets'],
            practiceTasks: [
              'Create 10 content ideas for one brand',
              'Write 5 reel concepts with hooks',
              'Prepare a 30-day content calendar',
            ],
            finalDeliverable:
              '30-Day Content Calendar with captions, visual direction, hooks and campaign structure.',
          },
        ],
      },
      {
        id: 'intermediate',
        name: 'Intermediate',
        color: 'yellow',
        summary:
          'Run paid campaigns, build landing pages and report performance like an agency.',
        packages: [
          {
            id: 'wp-03',
            number: '03',
            title: 'Paid Ads Fundamentals',
            duration: '2 weeks',
            goal:
              'Understand campaign objectives, audience setup, ad structure, budget planning and testing.',
            skills: ['Meta ads', 'Campaign objective', 'Audience testing', 'Ad copy'],
            tools: ['Meta Ads Manager', 'Google Ads', 'Canva'],
            practiceTasks: [
              'Create 3 campaign structures for awareness, leads and conversion',
              'Write 10 ad copy variations',
              'Build an audience testing plan',
            ],
            finalDeliverable:
              'Paid Ads Campaign Blueprint with objectives, creatives, targeting and budget split.',
          },
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced',
        color: 'pink',
        summary:
          'Think like a growth strategist. Run sprint-based experiments and prepare portfolio-ready campaign systems.',
        packages: [
          {
            id: 'wp-04',
            number: '04',
            title: 'Growth Strategy Sprint',
            duration: '3 weeks',
            goal:
              'Design a 90-day growth strategy using funnel thinking, experiments and campaign planning.',
            skills: ['Funnel strategy', 'Experiment design', 'CAC and LTV modelling', 'Channel prioritisation'],
            tools: ['Notion', 'Google Sheets', 'Looker Studio'],
            practiceTasks: [
              'Map an AARRR funnel for 2 SaaS brands',
              'Design 3 growth experiments with hypothesis and success criteria',
              'Model CAC vs LTV for 3 marketing channels',
            ],
            finalDeliverable:
              '90-Day Growth Strategy: funnel audit, channel mix, experiment backlog, budget model and KPI dashboard.',
          },
        ],
      },
    ] as CourseLevel[],
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
]

const tabs = ['Overview', 'Syllabus', 'Assignments', 'Marking Criteria', 'Tools', 'Portfolio Outputs']

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

function EditButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

export function CourseDetailTemplate() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState('Overview')
  const [openPackage, setOpenPackage] = useState('')

  const courseId = String(params?.id || '')
  const course = courseDetails.find((item) => item.id === courseId) || courseDetails[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← All Courses
        </Link>

        <div className="flex gap-2">
          <button className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Edit Course
          </button>
          <button className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black">
            Add Work Package
          </button>
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center bg-[#153e90]/10 text-xl font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
            {course.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
              {course.type.toUpperCase()} COURSE BLUEPRINT
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{course.name}</h1>
            <p className="mt-1 text-[#153e90] dark:text-[#6ee75a]">{course.tagline}</p>
            <p className="mt-3 max-w-4xl text-muted-foreground">{course.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.duration}</p>
          <p className="mt-1 text-sm text-muted-foreground">Duration</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.workPackages}</p>
          <p className="mt-1 text-sm text-muted-foreground">Work Packages</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.portfolioOutputs}</p>
          <p className="mt-1 text-sm text-muted-foreground">Portfolio Outputs</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.passMark}%</p>
          <p className="mt-1 text-sm text-muted-foreground">Pass Mark</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border border-border bg-card p-2 md:grid-cols-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-[#153e90] text-white dark:bg-[#6ee75a] dark:text-black'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Curriculum Structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">Course levels and work package summary.</p>
            </div>
            <EditButton>Edit Overview</EditButton>
          </div>

          <div className="mt-6 space-y-4">
            {course.levels.map((level) => (
              <div key={level.id} className="flex gap-4">
                <span className={cn('flex h-8 w-8 items-center justify-center border text-sm font-bold', levelStyle(level.color))}>
                  {level.packages.length}
                </span>
                <div>
                  <p className="font-semibold">{level.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{level.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Syllabus' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Syllabus Structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Work packages grouped by Foundation, Intermediate and Advanced levels.
              </p>
            </div>

            <div className="flex gap-2">
              <EditButton>Edit Syllabus</EditButton>
              <button className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white dark:bg-[#6ee75a] dark:text-black">
                Add Package
              </button>
            </div>
          </div>

          <div className="mt-7 space-y-8">
            {course.levels.map((level) => (
              <div key={level.id} className={cn('border-l-2 pl-5', levelBorder(level.color))}>
                <div className="mb-4">
                  <span className={cn('inline-flex border px-3 py-1 text-xs font-bold', levelStyle(level.color))}>
                    {level.name}
                  </span>
                  <span className="ml-3 text-sm text-muted-foreground">{level.packages.length} packages</span>
                  <p className="mt-3 text-sm text-muted-foreground">{level.summary}</p>
                </div>

                <div className="space-y-3">
                  {level.packages.map((workPackage) => {
                    const isOpen = openPackage === workPackage.id

                    return (
                      <div key={workPackage.id} className="border border-border bg-background">
                        <button
                          type="button"
                          onClick={() => setOpenPackage(isOpen ? '' : workPackage.id)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                        >
                          <div className="flex items-center gap-4">
                            <span className="bg-muted px-2 py-1 text-xs font-bold">{workPackage.number}</span>
                            <div>
                              <p className="font-semibold">{workPackage.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{workPackage.duration}</p>
                            </div>
                          </div>

                          <span className="text-muted-foreground">{isOpen ? '⌄' : '›'}</span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border p-4">
                            <div className="mb-5 flex justify-end gap-2">
                              <EditButton>Edit Package</EditButton>
                              <button className="border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10">
                                Delete
                              </button>
                            </div>

                            <div className="space-y-5">
                              <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">Goal</p>
                                <p className="mt-2 font-medium">{workPackage.goal}</p>
                              </div>

                              <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground">Skills</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {workPackage.skills.map((skill) => (
                                      <span key={skill} className="border border-border bg-card px-2 py-1 text-xs">
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground">Tools</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {workPackage.tools.map((tool) => (
                                      <span key={tool} className="border border-border bg-card px-2 py-1 text-xs">
                                        {tool}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">Practice Tasks</p>
                                <ul className="mt-3 space-y-2 text-sm">
                                  {workPackage.practiceTasks.map((task) => (
                                    <li key={task}>○ {task}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="border border-[#153e90]/40 bg-[#153e90]/5 p-4 dark:border-[#6ee75a]/40 dark:bg-[#6ee75a]/5">
                                <p className="text-xs font-bold uppercase text-[#153e90] dark:text-[#6ee75a]">
                                  Final Deliverable
                                </p>
                                <p className="mt-2 text-sm font-medium">{workPackage.finalDeliverable}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Assignments' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Assignments</h2>
              <p className="mt-1 text-sm text-muted-foreground">Assignment and project list attached to this course.</p>
            </div>
            <EditButton>Edit Assignments</EditButton>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {course.assignments.map((assignment, index) => (
              <div key={assignment} className="border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Assignment {String(index + 1).padStart(2, '0')}</p>
                <p className="mt-2 font-semibold">{assignment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Marking Criteria' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Evaluation Rubric</h2>
              <p className="mt-1 text-sm text-muted-foreground">Marks distribution for evaluation and final QA.</p>
            </div>
            <EditButton>Edit Rubric</EditButton>
          </div>

          <div className="mt-5 space-y-3">
            {course.rubric.map((item) => (
              <div key={item.label} className="flex items-center justify-between border border-border bg-background p-4">
                <span className="font-semibold">{item.label}</span>
                <span className="text-[#153e90] dark:text-[#6ee75a]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Tools' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Tools Used</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tools students need to learn and use in this course.</p>
            </div>
            <EditButton>Edit Tools</EditButton>
          </div>

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
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Portfolio Outputs</h2>
              <p className="mt-1 text-sm text-muted-foreground">Final outputs students should complete before course completion.</p>
            </div>
            <EditButton>Edit Outputs</EditButton>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {course.outputs.map((output, index) => (
              <div key={output} className="border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Output {String(index + 1).padStart(2, '0')}</p>
                <p className="mt-2 font-semibold">{output}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}