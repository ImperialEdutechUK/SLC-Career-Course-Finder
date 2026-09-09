/** Server configuration. Only intentionally public values reach the browser. */

function flag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

export const config = {
  questionnaireVersion: process.env.QUESTIONNAIRE_VERSION ?? '2026-09-08.1',
  slcCourseOrigin: process.env.SLC_COURSE_ORIGIN ?? 'https://southlondoncollege.org',
  allowedCourseUrlHosts: (process.env.ALLOWED_COURSE_URL_HOSTS ?? 'southlondoncollege.org')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean),

  /**
   * Both optional branches stay off until SLC reviewed content exists.
   * questionnaire.json requires reviewer, date and version bindings before either
   * question may render; an unresolved binding must not render.
   */
  careerC7Enabled: flag('CAREER_C7_ENABLED', false),
  courseF6Enabled: flag('COURSE_F6_ENABLED', false),

  sessionRestoreEnabled: flag('SESSION_RESTORE_ENABLED', false),
  savedResultsEnabled: flag('SAVED_RESULTS_ENABLED', false),
  contactRequestsEnabled: flag('CONTACT_REQUESTS_ENABLED', false),
  marketingOptInEnabled: flag('MARKETING_OPT_IN_ENABLED', false),
  nonEssentialAnalyticsEnabled: flag('NONESSENTIAL_ANALYTICS_ENABLED', false),

  /** AI is optional and disabled. Every explanation below is a deterministic template. */
  aiExplanationsEnabled: flag('AI_EXPLANATIONS_ENABLED', false),

  /** Server-owned goal allowlist. Empty: goal-only ranking is disabled. */
  approvedSpecificGoalIds: [] as string[],

  careerMapVersion: 'career-map-0.1.0-provisional',
  rulesVersion: 'entry-rules-0.1.0-none-published'
} as const;

/** Values that are safe to render into the client bundle. */
export const publicConfig = {
  slcCourseOrigin: config.slcCourseOrigin,
  aiExplanationsEnabled: config.aiExplanationsEnabled
} as const;
