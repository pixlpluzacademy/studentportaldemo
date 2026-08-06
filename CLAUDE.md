# CLAUDE.md — Pixel Pluz LMS Portal Development Rules

You are working on the **Pixel Pluz LMS / Student Portal**. Act like a careful senior full-stack developer. The project already has major backend/Supabase work completed, so your main job is to **protect existing functionality**, make **small controlled changes**, and avoid messy rewrites.

## 1. Project identity

- Product: **Pixel Pluz LMS Portal / Student Portal**
- Organization: **Pixel Pluz Academy**
- Purpose: academic LMS, student management, batch/course management, attendance, tasks, submissions, HOD review, final QA, complaints, mentor ratings, placement, certificates, reports.
- This is **not** a CRM and **not** a full ERP.
- Keep company management minimal. Main hierarchy is academy → branch → department/course → batch → staff/students.

## 2. Current stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Radix/shadcn UI components
- Supabase Auth, Postgres, RLS, Storage
- pnpm package manager

Use existing project conventions. Do not introduce a new backend, ORM, UI kit, state library, auth system, or styling system unless the user explicitly asks.

## 3. Very important safety rules

1. **Do not make large rewrites.** Change only the files needed for the user’s exact request.
2. **Do not redesign UI/layout** unless the user explicitly asks for design changes.
3. **Do not remove existing features, routes, permissions, tables, or migrations** unless the user explicitly asks.
4. **Do not rename routes, database tables, columns, functions, roles, or permission keys** without explaining the impact first.
5. **Do not edit old/legacy modules unless the current task is about them.**
6. **Do not hardcode role names like HOD, Trainer, QA, Teacher for access logic.** Access must be permission-based.
7. **Do not expose or print secrets** from `.env`, `.env.local`, Supabase keys, or service role keys.
8. **Do not run destructive commands** such as `rm -rf`, migration reset, database wipe, mass format, mass rename, or bulk replace without explicit user approval.
9. **Do not commit, push, deploy, or run production database changes** unless the user asks.
10. **Before modifying anything, inspect the related files and understand the current pattern.**

## 4. Required working method

For every task, follow this workflow:

### Step A — Inspect first

Before coding, inspect:

- related page in `app/...`
- related data file in `lib/data/...`
- related auth/permission file in `lib/auth/...`
- related Supabase migration if database is involved
- related UI component if shared components are involved

Then explain briefly:

- what you found
- which files need to change
- what you will not touch

### Step B — Make a minimal plan

Give a short plan before editing. Keep it phase-by-phase. One module at a time.

### Step C — Edit only scoped files

Only edit files required for the task. Preserve existing code style, naming, layout, and structure.

### Step D — Validate

After edits, run safe checks when possible:

```bash
pnpm lint
pnpm build
```

If those are too slow or blocked, at least run TypeScript/build-related checks that are available in this project.

### Step E — Show exact changes

After editing, summarize:

- files changed
- what changed
- how to test manually
- any risk or unfinished part

## 5. Product access model

Access is **permission-based with fixed parent roles**, not simple role-only checks.

```text
Parent Role → Permission Profile → Permissions → Assignments / Scope
```

### Fixed parent roles

Use these as backend categories only:

1. Super Admin
2. Company Admin
3. Branch Admin
4. Mentor
5. Student
6. Placement

### Permission profiles

Custom profiles live under parent roles. Examples:

- HOD / Superior Mentor
- Trainer
- Normal Mentor
- Final QA
- Future profiles

Important:

- HOD and Final QA are **not parent roles** in the database.
- They are permission profiles under the correct parent role, usually Mentor.
- Do not build access using profile display names.
- Use permissions and parent role IDs/functions already in the project.

### Permission key pattern

Permission keys follow:

```text
module.action
```

Examples:

- `students.view`
- `attendance.mark`
- `tasks.create`
- `submissions.review`
- `hod_review.approve`
- `final_qa.validate`

Reuse existing types from `lib/demo/types.ts`, `lib/auth/types.ts`, and `lib/auth/modules.ts` where possible.

## 6. LMS hierarchy

```text
Branch → Department / Skill Area → Course → Batch → HOD / Mentor / Trainer → Students
```

Operational visibility:

- Admin: branch-based scope + permissions
- HOD / Superior Mentor: assigned batches, assigned mentors, and students under those batches
- Mentor / Trainer: assigned batches and assigned students only
- Student: own data only
- Placement: placement-related modules only, based on permissions

## 7. Core academic flow

The evaluation flow must remain:

```text
Student Submission → Mentor Review → HOD Approval → Final QA → Completed
```

Rules:

- Mentor rejection sends the task back to the student for resubmission.
- HOD or Final QA rejection restarts from mentor review.
- Latest marks/comments/attachments stay in the main view.
- Previous attempts must remain in history/past attempts.
- Do not allow submit after due date.
- Do not skip HOD or Final QA steps unless the existing permissions/workflow explicitly allow it.

## 8. Module-specific rules

### Attendance

- `/attendance` has view and mark flows.
- Mark attendance for **today only** unless user requests a controlled change.
- Online batch can have class link while marking.
- Hide class link in student day-wise view.
- No export button for now unless user asks.

### Students

- Student sees own data only.
- Mentor sees assigned batch/student data only.
- HOD sees students under assigned batches/mentors.
- Admin sees branch-scoped data if permitted.

### Mentors

- HOD sees mentors assigned under them.
- Admin sees branch-scoped mentors if permitted.
- Do not expose complaints to mentors/HOD.

### Complaints and mentor ratings

- Students can complain/rate only assigned mentors/trainers/HODs connected to their batches.
- Mentors/HODs must not see complaints against themselves.
- Admin can see complaints by branch scope.
- Ratings are rating-only unless existing code says otherwise.

### Class materials

- Mentor/HOD can upload daily notes.
- Online batch: notes + optional link.
- Offline batch: notes only.
- Student: view/download own batch materials.

### Tasks/submissions/marks

- Task assignment can be batch-wise or student-wise.
- Student sees assigned tasks only.
- Review chain must remain mentor → HOD → Final QA.
- Keep attempt history.

## 9. Data and legacy boundaries

### Main LMS data layer

Prefer these areas for active LMS work:

- `lib/auth/*`
- `lib/data/*`
- `lib/supabase/*`
- `app/users`, `app/role-management`, `app/branches`, `app/departments`, `app/courses`, `app/batches`, `app/students`, `app/mentors`, `app/attendance`, `app/class-materials`, `app/tasks`, `app/task-submissions`, `app/hod-review`, `app/final-qa`, `app/marks`, `app/complaints`
- `supabase/migrations/*`

### Legacy/demo areas

Be careful with these. Do not merge them into the main LMS model unless specifically asked:

- `lib/mock-data.ts`
- `lib/data-context.tsx`
- `lib/workstream-data.ts`
- `lib/app-context.tsx`
- old routes like `workstreams`, `projects`, `cohorts`, `analytics`, `admissions`, `review-studio`, old `submissions/*`, `allusers/*`, old `attendance/[id]`
- old `app/api/admin/*` routes may expect outdated schema; rewrite only when the task requires it.

## 10. Supabase/database rules

- Treat existing migrations as production history.
- Do not edit old migration files unless user explicitly says this is a local-only project and wants that.
- For schema changes, create a new migration with the next number.
- Do not reset the database or delete data.
- Do not weaken RLS policies to “make it work.” Fix scope logic properly.
- Server-only Supabase service role code must stay server-only.
- Client components must never import service role/admin clients.
- Always consider RLS and branch/batch/student scope when changing queries.

## 11. UI rules

- Preserve existing page structure unless user asks.
- Dark-mode focused SaaS dashboard.
- Cards: `border border-border bg-card`.
- Inputs: `bg-background` with thin border.
- Tables: clean header with `bg-muted/40`.
- Buttons: light mode primary `#153e90`, dark mode primary `#6ee75a`.
- Keep table horizontal scrolling inside table container only: `overflow-x-auto`.
- Do not create full-page horizontal overflow.
- Prefer custom SVG icons in `public/icons/dark-mode` and `public/icons/light-mode`.
- Avoid Lucide icons unless already used in that exact area or user asks.

## 12. Coding style

- TypeScript strictness matters.
- Prefer existing helper functions over creating new duplicate logic.
- Keep server/client boundaries clean.
- Use `"use client"` only when necessary.
- Do not add unnecessary dependencies.
- Do not convert working server components into client components without a reason.
- Do not silently change URLs, labels, permission names, or table columns.
- When changing forms, preserve validation and error handling.

## 13. How to handle user requests

When the user asks for a feature or fix:

1. Restate the task in simple terms.
2. Inspect relevant files.
3. Explain the exact files to change.
4. Ask for confirmation before editing if the change touches auth, permissions, database, or many files.
5. For small UI/text fixes, make the change directly if clearly safe.
6. After editing, provide testing steps.

## 14. Dangerous tasks that need explicit approval

Ask before doing any of these:

- database migration creation
- RLS policy change
- auth/session change
- permission model change
- route restructuring
- layout redesign
- deleting old files
- removing demo/legacy code
- package upgrades
- dependency additions
- changing environment variables
- deployment
- git commit/push

## 15. First commands to run in a new Claude Code session

Run only safe inspection commands first:

```bash
git status
pnpm --version
node --version
cat package.json
find app lib components supabase/migrations -maxdepth 2 -type f | sort | head -200
```

Do not start editing until the task scope is clear.

## 16. Standard response format after changes

Use this format:

```text
Changed files:
- path/file.tsx — short reason

What changed:
- point 1
- point 2

How to test:
- step 1
- step 2

Notes/Risks:
- any risk or pending item
```

## 17. Current project status summary

Based on the current repository structure:

- Supabase integration exists under `lib/supabase/*`.
- Auth provider exists under `lib/auth/provider.tsx`.
- Main data layer exists under `lib/data/*`.
- Multiple Supabase migrations already exist, including foundation, RLS, roles, departments, courses, batches, class materials, attendance, tasks, submissions, complaints, and mentor ratings.
- Existing Cursor rules are in `.cursor/rules/pixel-pluz-lms.mdc`; preserve the same intent here.

Your top priority is stability. Do not make the portal messy. Make small, safe, reversible changes.
