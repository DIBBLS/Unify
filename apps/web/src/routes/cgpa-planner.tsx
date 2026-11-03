import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabaseBrowser } from '../lib/supabase'
import { toastError, toastSuccess } from '../lib/toast'
import { api, type Profile } from '../lib/api'
import { 
  calculateNeededGPA, 
  getCGPALabel, 
  calculateRoadmap,
  calculateWhatIf,
  validateCGPA 
} from '../lib/cgpa'
import { BoxBoy } from '../components/redesign/brand'
import Loading from '../components/Loading'
import '@/styles/redesign/index.css'

type Step = 'enter' | 'courses' | 'target' | 'plan'

interface CourseStatus {
  code: string
  title: string
  units: number
  status: 'done' | 'priority' | 'not_yet'
  grade?: number
}

/**
 * S15-S18: CGPA Planner
 * 4-step flow: Enter CGPA → Mark courses → Pick target → See plan
 */
export default function CGPAPlannerRoute() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<Step>('enter')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // User data
  const [profile, setProfile] = useState<Profile | null>(null)
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([])
  
  // S15: Enter CGPA
  const [currentCGPA, setCurrentCGPA] = useState('')
  const [hasStarted, setHasStarted] = useState(true)
  
  // S16: Course status
  const [courses, setCourses] = useState<CourseStatus[]>([])
  
  // S17: Target
  const [target, setTarget] = useState(4.0)
  
  // Calculated
  const unitsDone = courses.filter(c => c.status === 'done').reduce((sum, c) => sum + c.units, 0)
  const unitsRemaining = courses.filter(c => c.status !== 'done').reduce((sum, c) => sum + c.units, 0)
  const calculation = currentCGPA ? getCGPALabel(
    calculateNeededGPA(target, parseFloat(currentCGPA), unitsDone, unitsRemaining)
  ) : null
  
  useEffect(() => {
    loadProfile()
  }, [])
  
  const loadProfile = async () => {
    try {
      const sb = supabaseBrowser()
      if (!sb) throw new Error('Not authenticated')
      
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const me = await api.me()
      if (!me.profile) throw new Error('Profile not found')
      
      setProfile(me.profile)
      
      // Pre-fill if already set
      if (me.profile.cgpa_current != null) {
        setCurrentCGPA(me.profile.cgpa_current.toString())
        setHasStarted(true)
      }
      if (me.profile.cgpa_target != null) {
        setTarget(parseFloat(me.profile.cgpa_target.toString()))
      }
      
      // Load enrolled courses
      const { data: enrollments } = await sb
        .from('enrollments')
        .select('course')
        .eq('user_id', user.id)
      
      if (enrollments) {
        const codes = enrollments.map(e => e.course)
        setEnrolledCourses(codes)
        
        // Load course details
        const { data: courseData } = await sb
          .from('courses')
          .select('code, title')
          .in('code', codes)
        
        if (courseData) {
          // Load saved course statuses
          const { data: statusData } = await sb
            .from('course_status')
            .select('*')
            .eq('user_id', user.id)
          
          const statusMap = new Map(
            statusData?.map(s => [s.course_code, s]) || []
          )
          
          const courseList: CourseStatus[] = courseData.map(c => {
            const saved = statusMap.get(c.code)
            return {
              code: c.code,
              title: c.title,
              units: saved?.units || 3,
              status: (saved?.status as 'done' | 'priority' | 'not_yet') || 'not_yet',
              grade: saved?.grade || undefined
            }
          })
          
          setCourses(courseList)
        }
      }
      
      // Check query param for direct step
      const stepParam = searchParams.get('step') as Step | null
      if (stepParam && ['enter', 'courses', 'target', 'plan'].includes(stepParam)) {
        setStep(stepParam)
      } else if (me.profile.cgpa_current != null) {
        // Already has CGPA, jump to courses or plan
        setStep('courses')
      }
      
    } catch (err) {
      console.error('Load profile failed:', err)
      toastError('Could not load profile')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }
  
  const handleEnterContinue = () => {
    if (!hasStarted) {
      // Skip to target (no courses to mark)
      setStep('target')
      return
    }
    
    const cgpa = validateCGPA(currentCGPA)
    if (cgpa == null) {
      toastError('Enter a valid CGPA (0.00-5.00)')
      return
    }
    
    setStep('courses')
  }
  
  const handleCoursesContinue = async () => {
    // Save course statuses
    setSaving(true)
    try {
      const sb = supabaseBrowser()
      if (!sb) throw new Error('Not authenticated')
      
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      // Upsert all course statuses
      const rows = courses.map(c => ({
        user_id: user.id,
        course_code: c.code,
        status: c.status,
        units: c.units,
        grade: c.grade
      }))
      
      const { error } = await sb
        .from('course_status')
        .upsert(rows)
      
      if (error) throw error
      
      setStep('target')
    } catch (err) {
      console.error('Save courses failed:', err)
      toastError('Could not save course status')
    } finally {
      setSaving(false)
    }
  }
  
  const handleTargetContinue = () => {
    setStep('plan')
  }
  
  const handleLockItIn = async () => {
    setSaving(true)
    try {
      const sb = supabaseBrowser()
      if (!sb) throw new Error('Not authenticated')
      
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const cgpa = validateCGPA(currentCGPA)
      if (cgpa == null) throw new Error('Invalid CGPA')
      
      // Save CGPA target to profile
      const { error } = await sb
        .from('profiles')
        .update({
          cgpa_current: cgpa,
          cgpa_target: target,
          hide_cgpa: false
        })
        .eq('id', user.id)
      
      if (error) throw error
      
      toastSuccess('CGPA target set!')
      navigate('/dashboard')
      
    } catch (err) {
      console.error('Save target failed:', err)
      toastError('Could not save target')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) return <Loading text="Loading..." />
  
  return (
    <div className="screen">
      {/* Top bar */}
      <div 
        className="row between" 
        style={{ 
          padding: '16px', 
          borderBottom: '1px solid var(--u-hairline)' 
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (step === 'enter') navigate(-1)
            else if (step === 'courses') setStep('enter')
            else if (step === 'target') setStep('courses')
            else if (step === 'plan') setStep('target')
          }}
          className="row"
          style={{ 
            gap: 8, 
            border: 0, 
            background: 'transparent', 
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600
          }}
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <div className="t-13 faint">
          Step {step === 'enter' ? 1 : step === 'courses' ? 2 : step === 'target' ? 3 : 4} of 4
        </div>
      </div>
      
      <div className="pad stack" style={{ flex: 1, paddingTop: 32, paddingBottom: 40 }}>
        {step === 'enter' && (
          <EnterCGPA
            currentCGPA={currentCGPA}
            setCurrentCGPA={setCurrentCGPA}
            hasStarted={hasStarted}
            setHasStarted={setHasStarted}
            onContinue={handleEnterContinue}
          />
        )}
        
        {step === 'courses' && (
          <CourseStatus
            courses={courses}
            setCourses={setCourses}
            onContinue={handleCoursesContinue}
            saving={saving}
          />
        )}
        
        {step === 'target' && calculation && (
          <TargetPicker
            target={target}
            setTarget={setTarget}
            calculation={calculation}
            onContinue={handleTargetContinue}
          />
        )}
        
        {step === 'plan' && calculation && (
          <ThePlan
            target={target}
            currentCGPA={parseFloat(currentCGPA)}
            unitsDone={unitsDone}
            unitsRemaining={unitsRemaining}
            calculation={calculation}
            onLockItIn={handleLockItIn}
            onAdjust={() => setStep('target')}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}

// S15: Enter CGPA
function EnterCGPA({ 
  currentCGPA, 
  setCurrentCGPA, 
  hasStarted, 
  setHasStarted, 
  onContinue 
}: {
  currentCGPA: string
  setCurrentCGPA: (v: string) => void
  hasStarted: boolean
  setHasStarted: (v: boolean) => void
  onContinue: () => void
}) {
  return (
    <div className="stack" style={{ gap: 32, flex: 1 }}>
      <div className="stack center" style={{ gap: 16 }}>
        <BoxBoy pose="readingStanding" width={120} />
        <h1 className="display center" style={{ fontSize: 26 }}>
          WHAT'S YOUR<br />CURRENT CGPA?
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 300 }}>
          Not per-course grades. Just your overall CGPA so far.
        </p>
      </div>
      
      {hasStarted ? (
        <div style={{ maxWidth: 200, margin: '0 auto', width: '100%' }}>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5"
            value={currentCGPA}
            onChange={(e) => setCurrentCGPA(e.target.value)}
            placeholder="0.00"
            className="input"
            style={{ 
              textAlign: 'center', 
              fontSize: 32, 
              fontWeight: 700,
              height: 80
            }}
            autoFocus
          />
          <div className="t-12 faint center" style={{ marginTop: 8 }}>
            0.00 – 5.00
          </div>
        </div>
      ) : (
        <div className="stack center" style={{ gap: 12 }}>
          <p className="t-15 muted">Haven't started yet?</p>
          <button
            type="button"
            onClick={() => setHasStarted(true)}
            className="btn btn--outline"
          >
            Actually, I have a CGPA
          </button>
        </div>
      )}
      
      <div style={{ marginTop: 'auto' }}>
        <button
          type="button"
          onClick={onContinue}
          className="btn btn--amber btn--block"
          style={{ height: 56 }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// S16: Course status
function CourseStatus({
  courses,
  setCourses,
  onContinue,
  saving
}: {
  courses: CourseStatus[]
  setCourses: (c: CourseStatus[]) => void
  onContinue: () => void
  saving: boolean
}) {
  const toggleStatus = (code: string) => {
    setCourses(courses.map(c => {
      if (c.code !== code) return c
      const next: CourseStatus['status'] = 
        c.status === 'not_yet' ? 'priority' : 
        c.status === 'priority' ? 'done' : 
        'not_yet'
      return { ...c, status: next }
    }))
  }
  
  const done = courses.filter(c => c.status === 'done').length
  const priority = courses.filter(c => c.status === 'priority').length
  const unitsDone = courses.filter(c => c.status === 'done').reduce((sum, c) => sum + c.units, 0)
  const unitsRemaining = courses.filter(c => c.status !== 'done').reduce((sum, c) => sum + c.units, 0)
  
  return (
    <div className="stack" style={{ gap: 24, flex: 1 }}>
      <div className="stack center" style={{ gap: 12 }}>
        <h1 className="display center" style={{ fontSize: 24 }}>
          MARK YOUR<br />COURSES
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 320 }}>
          Done ✓ / Priority (compulsory) / Not yet
        </p>
      </div>
      
      <div className="stack" style={{ gap: 12 }}>
        {courses.map(course => (
          <button
            key={course.code}
            type="button"
            onClick={() => toggleStatus(course.code)}
            className="card"
            style={{
              padding: 16,
              textAlign: 'left',
              cursor: 'pointer',
              border: `2px solid ${
                course.status === 'done' ? 'var(--u-good)' : 
                course.status === 'priority' ? 'var(--u-amber)' : 
                'var(--u-border)'
              }`
            }}
          >
            <div className="row between">
              <div style={{ flex: 1 }}>
                <div className="t-15 w-6">{course.title}</div>
                <div className="t-13 faint">{course.code} · {course.units} units</div>
              </div>
              <div 
                className="pill" 
                style={{
                  background: 
                    course.status === 'done' ? 'var(--u-good-tint)' : 
                    course.status === 'priority' ? 'var(--u-warn-tint)' : 
                    'var(--u-chip)',
                  color:
                    course.status === 'done' ? 'var(--u-good)' : 
                    course.status === 'priority' ? 'var(--u-warn-ink)' : 
                    'var(--u-text-3)'
                }}
              >
                {course.status === 'done' ? '✓ Done' : 
                 course.status === 'priority' ? 'Priority' : 
                 'Not yet'}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div 
        className="card card--tint" 
        style={{ padding: 16, marginTop: 'auto' }}
      >
        <div className="row between">
          <div>
            <div className="t-13 faint">Units done</div>
            <div className="t-20 w-7">{unitsDone}</div>
          </div>
          <div>
            <div className="t-13 faint">Remaining</div>
            <div className="t-20 w-7">{unitsRemaining}</div>
          </div>
          <div>
            <div className="t-13 faint">Priority</div>
            <div className="t-20 w-7">{priority}</div>
          </div>
        </div>
      </div>
      
      <button
        type="button"
        onClick={onContinue}
        disabled={saving}
        className="btn btn--amber btn--block"
        style={{ height: 56 }}
      >
        {saving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}

// S17: Target picker
function TargetPicker({
  target,
  setTarget,
  calculation,
  onContinue
}: {
  target: number
  setTarget: (v: number) => void
  calculation: ReturnType<typeof getCGPALabel>
  onContinue: () => void
}) {
  return (
    <div className="stack" style={{ gap: 32, flex: 1 }}>
      <div className="stack center" style={{ gap: 12 }}>
        <h1 className="display center" style={{ fontSize: 24 }}>
          PICK YOUR<br />TARGET
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 300 }}>
          Honest labels. No sugar-coating.
        </p>
      </div>
      
      <div style={{ padding: '0 16px' }}>
        <input
          type="range"
          min="2.5"
          max="5.0"
          step="0.1"
          value={target}
          onChange={(e) => setTarget(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <div className="row between" style={{ marginTop: 8 }}>
          <span className="t-12 faint">2.5</span>
          <span className="t-12 faint">5.0</span>
        </div>
      </div>
      
      <div 
        className="card" 
        style={{ 
          padding: 24, 
          borderColor: calculation.color,
          borderWidth: 3 
        }}
      >
        <div className="t-48 w-8 center" style={{ marginBottom: 16 }}>
          {target.toFixed(1)}
        </div>
        <div 
          className="pill"
          style={{ 
            background: calculation.color,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            padding: '8px 16px',
            marginBottom: 16,
            display: 'block',
            textAlign: 'center'
          }}
        >
          {calculation.label.toUpperCase().replace(/-/g, ' ')}
        </div>
        <p className="t-14 center muted">{calculation.description}</p>
        <div 
          className="card card--tint" 
          style={{ padding: 16, marginTop: 16 }}
        >
          <div className="t-13 faint center">You'd need a</div>
          <div className="t-32 w-8 center" style={{ color: calculation.color }}>
            {calculation.neededGPA.toFixed(2)}
          </div>
          <div className="t-13 faint center">GPA each semester</div>
        </div>
      </div>
      
      <button
        type="button"
        onClick={onContinue}
        className="btn btn--amber btn--block"
        style={{ height: 56, marginTop: 'auto' }}
      >
        See the plan
      </button>
    </div>
  )
}

// S18: The plan
function ThePlan({
  target,
  currentCGPA,
  unitsDone,
  unitsRemaining,
  calculation,
  onLockItIn,
  onAdjust,
  saving
}: {
  target: number
  currentCGPA: number
  unitsDone: number
  unitsRemaining: number
  calculation: ReturnType<typeof getCGPALabel>
  onLockItIn: () => void
  onAdjust: () => void
  saving: boolean
}) {
  const semestersLeft = Math.ceil(unitsRemaining / 18) // Assume 18 units/semester
  const roadmap = calculateRoadmap(target, currentCGPA, unitsDone, unitsRemaining, semestersLeft)
  const whatIfGPA = 3.8
  const neededAfter = calculateWhatIf(target, currentCGPA, unitsDone, unitsRemaining, whatIfGPA, 18)
  
  return (
    <div className="stack" style={{ gap: 24, flex: 1 }}>
      <div className="stack center" style={{ gap: 12 }}>
        <BoxBoy pose="cheer" width={100} />
        <h1 className="display center" style={{ fontSize: 24 }}>
          THE PLAN
        </h1>
      </div>
      
      {/* Roadmap */}
      <div className="card" style={{ padding: 20 }}>
        <div className="t-13 faint" style={{ marginBottom: 12 }}>ROADMAP</div>
        {roadmap.map((sem, i) => (
          <div key={i} className="row between" style={{ padding: '8px 0', borderBottom: i < roadmap.length - 1 ? '1px solid var(--u-hairline)' : 'none' }}>
            <div className="t-14 w-6">Semester {sem.semester}</div>
            <div className="t-14" style={{ color: calculation.color }}>
              {sem.gpa.toFixed(2)} GPA
            </div>
            <div className="t-13 faint">
              → {sem.cumulativeCGPA.toFixed(2)} CGPA
            </div>
          </div>
        ))}
      </div>
      
      {/* What-if */}
      <div className="card card--tint" style={{ padding: 20 }}>
        <div className="t-13 faint" style={{ marginBottom: 8 }}>WHAT IF...</div>
        <p className="t-14">
          If you get <strong>{whatIfGPA.toFixed(1)} this semester</strong>, you'd need <strong style={{ color: calculation.color }}>{neededAfter.toFixed(2)}</strong> after
        </p>
      </div>
      
      <div className="row" style={{ gap: 12, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={onAdjust}
          className="btn btn--outline"
          style={{ flex: 1 }}
        >
          Adjust my plan
        </button>
        <button
          type="button"
          onClick={onLockItIn}
          disabled={saving}
          className="btn btn--amber"
          style={{ flex: 1 }}
        >
          {saving ? 'Saving...' : 'Lock it in'}
        </button>
      </div>
    </div>
  )
}
