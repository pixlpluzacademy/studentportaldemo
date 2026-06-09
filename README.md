# pixlpluzportal

Frontend demo portal for the pixlpluzportal LMS (permission-based sidebar, branches, courses, batches, and academic workflows).

## Setup

- One company setup: pixlpluzportal Academy / pixlpluz.com
- Branch dropdown in the top header controls branch context for the demo
- Future branches included: Kochi, Calicut, TVM, Sri Lanka, Dubai
- Permission logic controls sidebar visibility, page access, and buttons
- Icon assets live under `public/icons/`

## Demo logins

Password for all accounts: `demo123`

| Role | Email |
|------|--------|
| Super Admin | superadmin@pixlpluzportal.demo |
| Admin | admin@pixlpluzportal.demo |
| Branch Admin | branch@pixlpluzportal.demo |
| Mentor | mentor@pixlpluzportal.demo |
| HOD | hod@pixlpluzportal.demo |
| QA | qa@pixlpluzportal.demo |
| Student | student@pixlpluzportal.demo |
| Placement | placement@pixlpluzportal.demo |

## Run

```bash
pnpm install
pnpm run dev
```

The dev script uses webpack to avoid Turbopack issues in some online builders.
