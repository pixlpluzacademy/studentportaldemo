# Pixel Pluz LMS Portal — Product Specification

> **Source of truth** for product scope, access control, module behavior, database design, and migration plan.  
> Companion rule: `.cursor/rules/pixel-pluz-lms.mdc`

---

## 1. Product identity

| Item | Value |
|------|--------|
| Product | Pixel Pluz LMS Portal |
| Organization | Pixel Pluz Academy |
| Domain purpose | Training & education management (LMS only) |
| **Not in scope** | CRM, full company ERP, heavy multi-company management |

Future branches (demo reference): Kochi, Calicut, TVM, Sri Lanka, Dubai.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| UI | Radix / shadcn components |
| Package manager | pnpm |
| Backend | Supabase Auth, PostgreSQL, Row Level Security (RLS), Storage |
| Hosting (planned) | Vercel + Supabase |

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to client)

---

## 3. Access control model

### 3.1 Core principle

This system is **not** simple role-based. It is **permission-based with fixed parent roles**.

```
Parent Role  →  Permission Profile  →  Permissions  →  Assignments (data scope)
```

**Final access** is calculated from all four layers. Page logic must not rely on hardcoded labels like “HOD”, “Trainer”, or “Final QA” as parent categories.

### 3.2 Fixed parent roles (6 backend categories)

| ID (proposed) | Name | Purpose |
|---------------|------|---------|
| `super_admin` | Super Admin | Single system owner; full access |
| `company_admin` | Company Admin | Academy-wide setup and oversight |
| `branch_admin` | Branch Admin | Branch-level academic and operations |
| `mentor` | Mentor | Teaching, review, batch staff work |
| `student` | Student | Own learning data only |
| `placement` | Placement | Placement-related modules only |

**Rules:**

- Parent roles are **fixed categories**, not customizable feature bundles.
- **Super Admin** — only one; created manually in Supabase, **not** creatable from UI.
- HOD, Trainer, Normal Mentor, Final QA are **permission profiles**, usually under parent role **Mentor**.

### 3.3 Permission profiles (customizable)

Profiles define *how* a user works within their parent role.

| Example profile | Parent role | Typical use |
|-----------------|-------------|-------------|
| HOD / Superior Mentor | Mentor | Oversees mentors & students in assigned batches |
| Trainer / Mentor | Mentor | Day-to-day teaching, attendance, tasks |
| Final QA | Mentor | Final validation and score locking |
| *(future profiles)* | Any parent | Added via Role Management UI without code changes |

Profiles are editable: module list + action permissions, same concept as current `/role-management` demo.

### 3.4 Permissions

**Actions:** `view`, `create`, `edit`, `delete`, `assign`, `review`, `approve`, `upload`, `download`, `export`, `lock`, `submit`, `mark`, `reply`, `resolve`, `validate`

**Format:** `{moduleId}.{action}` — e.g. `students.view`, `attendance.mark`, `final_qa.lock`

**Modules** (from `lib/demo/types.ts` / `lib/demo/seed.ts`):

| Module ID | Route | Label |
|-----------|-------|-------|
| `dashboard` | `/dashboard` | Dashboard |
| `companies` | `/companies` | Companies (minimal) |
| `branches` | `/branches` | Branches |
| `users` | `/users` | Users |
| `roles` | `/role-management` | Role Management |
| `courses` | `/courses` | Courses |
| `my-courses` | `/my-courses` | Course Overview |
| `class-materials` | `/class-materials` | Class Materials |
| `batches` | `/batches` | Batches |
| `students` | `/students` | Students |
| `mentors` | `/mentors` | Mentors |
| `attendance` | `/attendance` | Attendance |
| `tasks` | `/tasks` | Tasks |
| `submissions` | `/task-submissions` | Task Submissions |
| `marks` | `/marks` | Marks / Evaluation |
| `hod_review` | `/hod-review` | HOD Review |
| `final_qa` | `/final-qa` | Final QA |
| `placement` | `/placement` | Placement |
| `certificates` | `/certificates` | Certificates |
| `complaints` | `/complaints` | Complaints |
| `reports` | `/reports` | Reports |
| `settings` | `/settings` | Settings |

### 3.5 Assignments (data scope)

| Assignment type | Controls |
|-----------------|----------|
| Branch | Which branch data user sees |
| Batch | Which batches user works on |
| Batch staff role | HOD / Mentor / Trainer on a batch |
| Reports-to | HOD sees which mentors |
| Student enrollment | Student sees own batch/course |

### 3.6 Example scenarios

**Arjun Das**

- Parent role: Mentor  
- Permission profile: HOD / Superior Mentor  
- Assigned batch: Digital Marketing Basic Morning  
- Can view assigned mentors and students when permissions + batch assignment allow it  

**Nisha Varghese**

- Parent role: Mentor  
- Permission profile: Trainer / Mentor  
- Assigned batch: Digital Marketing Basic Morning  
- Can view assigned students, tasks, attendance, submissions  
- Cannot see Arjun’s management-level data unless permissions explicitly allow  

**Student**

- Parent role: Student  
- Own course, batch, attendance, tasks, submissions, marks, certificates only  

**Placement user**

- Parent role: Placement  
- Placement modules only, per profile permissions  

---

## 4. LMS hierarchy & relationships

```
Academy (Pixel Pluz)
 └── Branch
      └── Department / Skill Area
           └── Course (Basic | Advanced | Professional)
                └── Batch (online | offline)
                     ├── Batch staff (HOD, Mentor, Trainer)
                     └── Enrolled students
```

**Branch → Batch → HOD → Mentor → Students**

- **Department / skill area** links courses and eligible mentors.  
- **Specialization** decides who can be assigned to a course/batch.  
- **Batch assignment** decides who accesses that batch.  
- **Reports-to** decides visibility between staff.

### 4.1 Departments / skill areas (examples)

- Digital Marketing  
- Website Development  
- 3D Visualization  
- Data Science & AI  
- Cyber Security  
- Media Production  

Route: `departments`

### 4.2 Course model

| Field | Notes |
|-------|-------|
| Department / skill area | Required link |
| Course name | e.g. Digital Marketing |
| Course type | Basic, Advanced, Professional |
| Duration | By type (see below) |
| Description | |
| Tools | List |
| Modules | Curriculum modules |
| Tasks | |
| Assignments / projects | |
| Pass mark | |
| Status | active / inactive / archived |

**Course types & duration**

| Type | Duration |
|------|----------|
| Basic | 4 months (3 months course + 1 month internship) |
| Advanced | 2 months |
| Professional | 1 month |

Routes: `/courses`, `/courses/basic`, `/courses/advanced`, `/courses/professional`, `/courses/[id]`

### 4.3 Batch model

| Field | Notes |
|-------|-------|
| Branch | Required |
| Course | Required |
| Mode | `online` \| `offline` |
| Timing / schedule | |
| Seats | |
| Start / end dates | |
| Class day type | weekdays / weekend / custom |
| Class link | Online batches only |
| Status | |

**Batch staff example**

| Role on batch | Person |
|---------------|--------|
| HOD | Arjun Das |
| Mentor | Nisha Varghese |
| Trainer | Rahul Mathew |

Arjun can see Nisha and Rahul under this batch. Nisha and Rahul cannot see Arjun’s full management data unless permissions allow.

Routes: `/batches`, `/batches/online`, `/batches/offline`, `/batches/[id]`

### 4.4 Staff source (display only)

Field: `staff_source` or `organisation_source`

| Value | Meaning |
|-------|---------|
| `internal` | Pixel Pluz staff |
| `neo_digital_hub` | NEO Digital Hub (may teach Pixel Pluz batches) |
| `external` | External staff |

**Not used for main access control** — reporting/display only.

---

## 5. Module specifications

### 5.1 Authentication & session

| Current (demo) | Target (production) |
|----------------|---------------------|
| `lib/demo/auth.tsx` | Supabase Auth + cookie session (`@supabase/ssr`) |
| `localStorage` session | HTTP-only cookies |
| Hardcoded users in seed | `profiles` + auth.users |
| No middleware | `middleware.ts` route protection |

Login route: `/login`  
Public: `/login`, `/` (redirects to login)

Hook compatibility goal: keep `can(permission)` and `canModule(moduleId)` shape where possible to minimize page churn.

### 5.2 Role management (`/role-management`)

- Build and edit **permission profiles** under a parent role  
- Toggle modules and per-action permissions  
- Assign profile to users  
- Persist to Supabase (`permission_profiles`, `profile_permissions`, `user_permission_profiles`)  
- Super Admin profile is protected; not duplicable from UI  

### 5.3 Users (`/users`)

- Create users with parent role + permission profile + branch scope  
- Assign to batches where applicable  
- Super Admin creation blocked from UI  

### 5.4 Branches (`/branches`)

- Branch CRUD within permission scope  
- Branch controller assignment  
- Branch dropdown in header filters context for admins  

### 5.5 Students (`/students`, `/students/[id]`)

| Viewer | Scope |
|--------|-------|
| Super / Company / Branch Admin | By permission + branch scope |
| HOD | Students under assigned batches and assigned mentors |
| Mentor / Trainer | Assigned batches only |
| Student | Own record only |

### 5.6 Mentors (`/mentors`, `/mentors/[id]`)

| Viewer | Scope |
|--------|-------|
| HOD | Mentors assigned under them |
| Admins | Branch scope + permissions |
| Others | Per `batch_staff_assignments` + permissions |

### 5.7 Attendance (`/attendance`)

**Tabs:** View Attendance (default) | Mark Attendance

**View Attendance flow**

```
Batch summary  →  Students in batch  →  Student day-wise attendance
```

| Rule | Detail |
|------|--------|
| Admin visibility | Batch summaries by branch scope + permission |
| HOD | Assigned batches / mentors only |
| Mentor / Trainer | Assigned batches only |
| Student | Own day-wise attendance only |
| Class link | Hidden in student day-wise view |
| Export | Not required in v1 |

**Mark Attendance**

| Rule | Detail |
|------|--------|
| Who | Users with `attendance.mark` (and scope) |
| Date | **Today only** — no past or future |
| Online batch | May include class link when marking |
| Offline batch | Status marking only |

### 5.8 Class materials (`/class-materials`)

| Batch mode | Content |
|------------|---------|
| Offline | Daily notes / files only |
| Online | Notes + optional class/video link |

| Role | Capability |
|------|------------|
| Mentor / HOD | Upload, edit (per permissions) |
| Student | View, download, open links for own batch |

Storage bucket (Phase 4): `class-materials`

### 5.9 Tasks (`/tasks`, `/tasks/[id]`)

- Assign to batch or individual student  
- Fields: description, attachment requirement, due date, assignment type, preview  
- Students see only tasks for their batch/assignment  
- **Submission blocked after due date**  

Permissions: `tasks.view`, `tasks.create`, `tasks.assign`, etc.

### 5.10 Task submissions (`/task-submissions`, `/task-submissions/[id]`)

- Student submits files/text per task  
- Status workflow: draft → submitted → in review → approved / revision / rejected  
- Mentor review first; HOD and Final QA per permissions  

Storage bucket (Phase 4): `task-submissions`

### 5.11 Marks (`/marks`, `/marks-evaluation`)

| Field | Notes |
|-------|-------|
| Mentor score | |
| HOD score | |
| Final QA score | |
| Final score | |
| Comments | |
| Status | |

- Students see **own marks** only  
- Detail view may link to submission record  
- Final QA may **lock** evaluation (`final_qa.lock`)  

### 5.12 HOD review (`/hod-review`)

- Queue of submissions needing HOD review  
- Approve, request revision, comment — per `hod_review.*` permissions  
- Scoped to assigned batches/mentors  

### 5.13 Final QA (`/final-qa`)

- Final validation before completion  
- Validate, approve, lock scores — per `final_qa.*` permissions  

### 5.14 Placement (`/placement`)

- Placement readiness, resume, interviews, offers  
- Parent role Placement + profile permissions  
- Branch/batch scope where applicable  

### 5.15 Certificates (`/certificates`)

- Manual upload, issue date, student download  
- Storage bucket (Phase 4): `certificates`  

### 5.16 Complaints (`/complaints`)

- Student creates; staff reply/resolve per permissions  
- Priority and status tracking  

### 5.17 Reports (`/reports`)

- Academic, attendance, placement, branch reports  
- Export per permission (module supports export; attendance export deferred)  

### 5.18 Settings (`/settings`)

- Profile, theme, user preferences  
- Table: `user_preferences` or columns on `profiles`  

### 5.19 Dashboard (`/dashboard`)

- Role/profile-aware KPIs and quick actions  
- Data filtered by assignments + permissions  

### 5.20 My courses (`/my-courses`, `/my-courses/[id]`)

- Student and mentor course view: syllabus, tasks, attendance summary, submissions, marks  

### 5.21 Companies (`/companies`)

- **Minimal** — single academy context; not full ERP  
- Optional future multi-company flag; low priority  

---

## 6. Database schema (planned)

### 6.1 Auth & permissions

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users`: name, email, parent_role_id, branch_id, staff_source, status |
| `parent_roles` | Fixed 6 parent roles |
| `permission_profiles` | Custom profiles linked to parent_role_id |
| `permissions` | Catalog of `{module}.{action}` |
| `profile_permissions` | Many-to-many profile ↔ permission |
| `user_permission_profiles` | User ↔ active profile(s) |
| `user_branch_assignments` | User ↔ branch scope |

### 6.2 Organization & curriculum

| Table | Purpose |
|-------|---------|
| `branches` | Branch records |
| `departments` | Skill areas / specializations |
| `courses` | Course definitions |
| `course_modules` | Optional normalized curriculum |
| `batches` | Batch instances |
| `batch_staff_assignments` | User + batch + staff_type (hod, mentor, trainer) + reports_to |
| `students` | Student profile extension |
| `student_batch_enrollments` | Student ↔ batch |

### 6.3 Academic operations (Phase 3+)

| Table | Purpose |
|-------|---------|
| `attendance_sessions` | Daily session per batch |
| `attendance_records` | Per student per session |
| `class_materials` | Daily notes, files, links |
| `tasks` | Assignments |
| `task_submissions` | Student submissions |
| `marks` | Scores and comments |
| `hod_reviews` | HOD review records |
| `final_qa_reviews` | QA review records |

### 6.4 Operations (Phase 4)

| Table | Purpose |
|-------|---------|
| `placements` | Placement tracking |
| `certificates` | Certificate metadata + storage path |
| `complaints` | Complaint threads |
| `report_views` | Saved report configs (optional) |
| `user_preferences` | Theme, notifications, etc. |

### 6.5 RLS principles

- Every table: policies based on `auth.uid()`, parent role, permissions (via helper functions), and assignment joins  
- Students: row owner or enrollment match  
- Mentors: `batch_staff_assignments` match  
- HOD: batches where user is HOD + mentors reporting to them  
- Admins: branch_id in scope  
- Super Admin: bypass via secure function or explicit policy  

---

## 7. Repository map

### 7.1 Main LMS (migrate to Supabase)

**Auth / shell**

- `app/layout.tsx`
- `app/login/page.tsx`
- `components/app-shell.tsx`
- `components/demo/permission-gate.tsx`
- `lib/demo/auth.tsx` → replace
- `lib/demo/seed.ts` → seed reference only

**Core pages (demo data today)**

- `app/dashboard/page.tsx`
- `app/role-management/page.tsx`
- `app/users/page.tsx`
- `app/branches/page.tsx`
- `app/specializations/page.tsx`
- `app/courses/**`
- `components/courses/*`
- `app/batches/**`
- `app/students/**`
- `app/mentors/**`
- `app/my-courses/**`
- `app/attendance/page.tsx`
- `app/class-materials/page.tsx`
- `app/tasks/**`
- `app/task-submissions/**`
- `app/marks/**`
- `app/hod-review/page.tsx`
- `app/final-qa/page.tsx`
- `app/placement/page.tsx`
- `app/certificates/page.tsx`
- `app/complaints/page.tsx`
- `app/reports/page.tsx`
- `app/settings/page.tsx`
- `app/companies/page.tsx`

### 7.2 Legacy (do not merge into main LMS v1)

| Path | Reason |
|------|--------|
| `lib/mock-data.ts`, `lib/data-context.tsx`, `lib/workstream-data.ts` | Old workstream/cohort model |
| `lib/app-context.tsx` | Old localStorage role switcher |
| `app/workstreams/**`, `app/projects/**`, `app/cohorts/**` | Legacy curriculum model |
| `app/analytics`, `app/admissions`, `app/review-studio` | Out of LMS v1 scope |
| `app/submissions/**` (not task-submissions) | Old submission routes |
| `app/allusers/**`, `app/attendance/[id]` | Old Supabase cohort integration |
| `app/api/admin/*` | Outdated schema; rewrite in Phase 1 |

---

## 8. UI & UX constraints

Do **not** change layout or page structure unless explicitly requested.

| Element | Rule |
|---------|------|
| Cards | `border border-border bg-card` — no gradients, glow, decorative corners |
| Background | Existing dark dashboard background |
| Inputs | `bg-background`, thin border |
| Tables | Header `bg-muted/40`; container `overflow-x-auto` only |
| Buttons | Light: `#153e90` · Dark: `#6ee75a` |
| Accents | Blue (light), green (dark) |
| Icons | `public/icons/dark-mode`, `public/icons/light-mode` |
| Lucide | Avoid unless requested |

When updating files: provide **full file code** when user requests implementation; preserve unrelated features.

---

## 9. Migration plan

### Phase 1 — Foundation

- [ ] Supabase migrations: auth, profiles, parent roles, permission profiles, permissions, branches, departments, courses, batches, staff assignments, students  
- [ ] Seed parent roles, module permission catalog, default profiles (HOD, Trainer, Final QA under Mentor)  
- [ ] Install `@supabase/ssr`; add `lib/supabase/server.ts`, `middleware.ts`  
- [ ] Replace demo auth; RLS policies for core tables  
- [ ] Create Super Admin manually  
- [ ] Rewrite `app/api/admin/*` to new permission model  

**App still uses demo page data** until Phase 2.

### Phase 2 — Core LMS data

- [ ] role-management, users, branches, specializations  
- [ ] courses, batches, mentors, students, dashboard, my-courses  

### Phase 3 — Academic workflows

- [ ] attendance, class-materials, tasks, task-submissions, marks, hod-review, final-qa  

### Phase 4 — Operations & launch

- [ ] placement, certificates, complaints, reports, settings  
- [ ] Supabase Storage buckets + policies  
- [ ] Testing all parent roles + sample profiles  
- [ ] Deploy Vercel + production Supabase URLs  

---

## 10. Supabase dashboard checklist (before Phase 1 code)

- [ ] Project created; env vars in `.env.local`  
- [ ] Authentication → Email provider enabled  
- [ ] URL config: `http://localhost:3000/**`  
- [ ] Run migrations in SQL Editor (or Supabase CLI)  
- [ ] Create first Super Admin user  
- [ ] (Phase 4) Storage buckets: `class-materials`, `task-submissions`, `certificates`  

---

## 11. Out of scope (v1)

- Full CRM / ERP  
- Legacy workstream → LMS merge  
- Attendance export  
- Multi Super Admin creation from UI  
- Hardcoded role-name checks in application logic  

---

## 12. Document maintenance

Update this file when:

- New modules or permissions are added  
- Assignment rules change  
- Phase completion changes priorities  
- New permission profiles are introduced  

When starting work, tell the agent: **“Follow docs/LMS-SPEC.md and .cursor/rules/pixel-pluz-lms.mdc.”**
