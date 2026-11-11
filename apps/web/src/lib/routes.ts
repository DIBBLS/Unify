// Single source of truth for app paths. Names follow the redesign tabs
// (Home / Timetable / Class / Me), not the old screen names.
// Legacy paths stay as permanent redirects: the backend still writes
// "/dashboard", "/course" and "/studio" into notification links, push
// payloads and emails, and users have old bookmarks.
export const ROUTES = {
  welcome: '/welcome',
  auth: '/auth',
  onboarding: '/onboarding',
  persona: '/onboarding/persona',

  // Student tabs
  home: '/home',
  timetable: '/timetable',
  class: '/class',
  findCourses: '/courses/find',
  me: '/me',

  // Student content
  courses: '/courses',
  course: (code: string) => `/courses/${encodeURIComponent(code)}`,
  week: (code: string, week: number | string) => `/learn/${encodeURIComponent(code)}/week/${week}`,
  cgpa: '/cgpa-planner',
  notifications: '/notifications',

  // Author tabs (lecturer / contributor)
  studio: '/studio',
  browse: '/browse',
  myClasses: '/my-classes',
  lecturer: '/lecturer',

  // Attendance, HOC, online class
  attendanceSetup: '/attendance/setup',
  attendancePass: '/attendance/pass',
  attendanceMine: '/attendance/my',
  scanner: '/attendance/scanner',
  hoc: '/hoc',
  hocRequest: '/hoc/request',
  classList: '/class-list',
  onlineClass: '/online-class',

  admin: '/admin',
  adminContent: '/admin/content',

  // Dev/QA index of every screen
  screens: '/screens',
} as const;

/** Old path -> new path. `:param` segments are carried over by <LegacyRedirect>. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/dashboard': ROUTES.home,
  '/profile': ROUTES.me,
  '/course': ROUTES.courses,
  '/course/:courseCode': '/courses/:courseCode',
  '/explore': ROUTES.findCourses,
  '/classes': ROUTES.myClasses,
  '/lecturer/redesign': ROUTES.lecturer,
};
