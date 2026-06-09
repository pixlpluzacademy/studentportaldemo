/** App identity — use these constants instead of hard-coded GetSkill / Pixel Pluz strings. */
export const PROJECT_NAME = 'pixlpluzportal'
export const APP_DISPLAY_NAME = 'Pixlpluz Portal'
export const APP_DESCRIPTION = 'Creative tech education operating system'
export const DEMO_EMAIL_DOMAIN = 'pixlpluzportal.demo'
export const STORAGE_PREFIX = 'pixlpluzportal-demo'
export const DEFAULT_COMPANY_NAME = 'pixlpluzportal Academy'

export const storageKeys = {
  users: `${STORAGE_PREFIX}-users`,
  roles: `${STORAGE_PREFIX}-roles`,
  currentUser: `${STORAGE_PREFIX}-current-user`,
  activeBranch: `${STORAGE_PREFIX}-active-branch`,
} as const

export function demoEmail(localPart: string) {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`
}
