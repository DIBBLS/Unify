import Typewriter from '../Typewriter'
import { Link } from 'react-router-dom'
import { SemesterWeek, BoxBoy } from './brand'
import type { Profile } from '../../lib/api'
import { localGreeting, dailyProverb } from '../../lib/naija'

interface HomeHeroProps {
  profile: Profile
  firstName: string
  /** CGPA target + planner link: students only. */
  showCgpa?: boolean
}

/**
 * S14: Home hero with semester week tracker + CGPA target
 * Replaces generic greeting card
 */
export function HomeHero({ profile, firstName, showCgpa = false }: HomeHeroProps) {
  // Calculate current week (1-12)
  const currentWeek = getCurrentWeek(profile.semester_start, profile.semester_weeks || 12)
  
  // Today's greeting in a rotating Nigerian language, English alongside.
  const greet = localGreeting()

  // CGPA target set?
  const hasTarget = showCgpa && profile.cgpa_target != null
  
  return (
    <div 
      className="card card--dark african-dark" 
      style={{ 
        margin: '16px', 
        padding: '24px 20px 30px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="kente-edge" aria-hidden="true" />
      {/* Semester week tracker */}
      {profile.semester_start && currentWeek > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SemesterWeek week={currentWeek} total={profile.semester_weeks || 12} />
        </div>
      )}
      
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--u-amber)', marginBottom: 6 }}>
            <Typewriter text={`${greet.text} · ${greet.english}`} speed={32} />
          </div>
          <h1 className="display" style={{ fontSize: 28, color: 'var(--u-on-dark)' }}>
            {firstName || 'Welcome'}
          </h1>
          <div className="t-13" style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.45, maxWidth: 420 }}>{dailyProverb()}</div>
          {profile.department && (
            <div 
              className="pill pill--dark" 
              style={{ marginTop: 8, display: 'inline-flex' }}
            >
              {profile.department}
            </div>
          )}
        </div>
        <BoxBoy pose={hasTarget ? "targetSign" : "readingStanding"} width={72} style={{ flexShrink: 0 }} />
      </div>

      {/* CGPA target / Set target - inside hero (students only) */}
      {showCgpa && (
      <div style={{ marginTop: 20 }}>
        {hasTarget && !profile.hide_cgpa ? (
          <div
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 16,
              background: 'var(--u-card)',
              borderRadius: 16,
              border: '1px solid var(--u-border)'
            }}
          >
            <BoxBoy full pose="targetSign" width={60} />
            <div style={{ flex: 1 }}>
              <div className="t-13 muted">CGPA Target</div>
              <div className="t-20 w-7">{profile.cgpa_target?.toFixed(2)}</div>
              {profile.cgpa_current != null && (
                <div className="t-12 faint">
                  Current: {profile.cgpa_current.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link
            to="/cgpa-planner"
            className="btn btn--amber btn--block"
            style={{ marginTop: 12 }}
          >
            Set my target
          </Link>
        )}
      </div>
      )}
    </div>
  )
}

/**
 * Calculate current week in semester
 * Returns 0 if semester hasn't started or is over
 */
function getCurrentWeek(semesterStart: string | null | undefined, totalWeeks: number): number {
  if (!semesterStart) return 0
  
  const start = new Date(semesterStart)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  
  // Week 1-based (not 0-based)
  const week = diffWeeks + 1
  
  if (week < 1) return 0 // Hasn't started
  if (week > totalWeeks) return 0 // Semester over
  
  return week
}

/**
 * Time-based greeting
 */

