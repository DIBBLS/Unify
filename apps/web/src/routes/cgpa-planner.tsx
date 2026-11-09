import { FormSkeleton } from '../components/Skeletons'
import Slider from '../components/Slider';
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { toastError, toastSuccess } from '../lib/toast'
import { errorToast } from '../lib/errors'
import { api, type Profile } from '../lib/api'
import { 
  calculateNeededGPA, 
  getCGPALabel, 
  calculateRoadmap,
  calculateWhatIf,
  validateCGPA,
  cleanCgpaInput
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
  
  // S15: Enter CGPA. The CGPA covers every semester so far, so the math also
  // needs the units already completed and the degree total (estimates are fine).
  const [currentCGPA, setCurrentCGPA] = useState('')
  const [hasStarted, setHasStarted] = useState(true)
  const [priorUnits, setPriorUnits] = useState('')
  const [degreeUnits, setDegreeUnits] = useState('')
  
  // S16: Course status
  const [courses, setCourses] = useState<CourseStatus[]>([])
  
  // S17: Target
  const [target, setTarget] = useState(4.0)
  
  // Calculated
  // Completed = earlier semesters + courses marked done this semester; what is
  // left is the rest of the degree, not just this semester's courses.
  const doneThisSem = courses.filter(c => c.status === 'done').reduce((sum, c) => sum + c.units, 0)
  const unitsDone = (parseInt(priorUnits, 10) || 0) + doneThisSem
  const unitsRemaining = Math.max(0, (parseInt(degreeUnits, 10) || 0) - unitsDone)
  const calculation = currentCGPA ? getCGPALabel(
    calculateNeededGPA(target, parseFloat(currentCGPA), unitsDone, unitsRemaining)
  ) : null
  
  useEffect(() => {
    loadProfile()
  }, [])
  
  // Sensible starting estimates from the student's level (about 40 units per
  // year, 200 for the degree). They can overwrite both.
  const levelYears = (level?: string | null) => {
    const n = parseInt((level || '').replace(/\D/g, ''), 10)
    return Number.isFinite(n) && n >= 100 ? Math.max(0, n / 100 - 1) : 0
  }

  const loadProfile = async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.cgpa()])
      if (!me.profile) throw new Error('Profile not found')
      setProfile(me.profile)

      // Pre-fill if already set
      if (data.cgpaCurrent != null) {
        setCurrentCGPA(data.cgpaCurrent.toString())
        setHasStarted(true)
      } else if (data.cgpaTarget != null) {
        // Saved a target without a CGPA: a first-semester plan from zero.
        setCurrentCGPA('0')
        setHasStarted(false)
      }
      if (data.cgpaTarget != null) setTarget(data.cgpaTarget)
      setPriorUnits(String(data.unitsDone ?? Math.round(levelYears(data.level) * 40)))
      setDegreeUnits(String(data.unitsTotal ?? 200))
      setEnrolledCourses(data.courses.map(c => c.code))
      setCourses(data.courses.map(c => ({
        code: c.code,
        title: c.title,
        units: c.units || 3,
        status: c.status,
        grade: c.grade ?? undefined
      })))

      // Check query param for direct step
      const stepParam = searchParams.get('step') as Step | null
      const canPlan = data.cgpaCurrent != null || data.cgpaTarget != null
      if (stepParam && ['enter', 'courses', 'target', 'plan'].includes(stepParam)) {
        // The target and plan screens need a CGPA (or a from-zero plan) first.
        setStep((stepParam === 'target' || stepParam === 'plan') && !canPlan ? 'enter' : stepParam)
      } else if (data.cgpaCurrent != null) {
        // Already has CGPA, jump to courses
        setStep('courses')
      }
    } catch (err) {
      errorToast(err, 'load the planner')
      navigate('/home')
    } finally {
      setLoading(false)
    }
  }

  const handleEnterContinue = () => {
    if (!hasStarted) {
      // First semester: nothing earned yet, so plan from zero.
      setCurrentCGPA('0')
      setPriorUnits('0')
      if (!(parseInt(degreeUnits, 10) > 0)) setDegreeUnits('200')
      setStep('courses')
      return
    }
    
    const cgpa = validateCGPA(currentCGPA)
    if (cgpa == null) {
      toastError('Enter a CGPA from 0.00 to 5.00 (up to two decimals)')
      return
    }
    const done = parseInt(priorUnits, 10)
    const total = parseInt(degreeUnits, 10)
    if (!Number.isFinite(done) || done < 0 || !Number.isFinite(total) || total < 1) {
      toastError('Enter your completed units and your degree total (estimates are fine).')
      return
    }
    if (total < done) {
      toastError("Your degree total can't be less than the units you've completed.")
      return
    }

    setStep('courses')
  }
  
  const courseRows = () => courses.map(c => ({ code: c.code, status: c.status, units: c.units, grade: c.grade ?? null }))

  const handleCoursesContinue = async () => {
    // Save course statuses (and the CGPA basics) through the API
    setSaving(true)
    try {
      const cgpa = validateCGPA(currentCGPA)
      await api.cgpaSave({
        ...(cgpa != null && hasStarted ? { cgpaCurrent: cgpa } : {}),
        unitsDone: parseInt(priorUnits, 10) || 0,
        unitsTotal: parseInt(degreeUnits, 10) || 200,
        courses: courseRows(),
      })
      setStep('target')
    } catch (err) {
      errorToast(err, 'save your course status')
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
      const cgpa = validateCGPA(currentCGPA)
      if (cgpa == null) {
        toastError('Enter a CGPA from 0.00 to 5.00 (up to two decimals)')
        setStep('enter')
        return
      }
      if (hasStarted && target <= cgpa && cgpa < 5) {
        toastError(`Pick a target higher than your current CGPA (${cgpa.toFixed(2)})`)
        setStep('target')
        setSaving(false)
        return
      }
      await api.cgpaSave({
        ...(hasStarted ? { cgpaCurrent: cgpa } : {}),
        cgpaTarget: target,
        unitsDone: parseInt(priorUnits, 10) || 0,
        unitsTotal: parseInt(degreeUnits, 10) || 200,
        hide: false,
        courses: courseRows(),
      })
      toastSuccess('CGPA target set!')
      navigate('/home')
    } catch (err) {
      errorToast(err, 'save your target')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <FormSkeleton />
  
  return (
    <div className="screen screen--tabs">
      {/* Top bar */}
      <div 
        className="row between" 
        style={{ 
          padding: '16px', 
          borderBottom: '1px solid var(--u-hairline)' 
        }}
      >
        {(
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
        )}
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
            priorUnits={priorUnits}
            setPriorUnits={setPriorUnits}
            degreeUnits={degreeUnits}
            setDegreeUnits={setDegreeUnits}
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
            current={hasStarted ? validateCGPA(currentCGPA) : null}
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
            level={profile?.level || null}
            semester={profile?.semester || null}
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
  priorUnits,
  setPriorUnits,
  degreeUnits,
  setDegreeUnits,
  onContinue
}: {
  currentCGPA: string
  setCurrentCGPA: (v: string) => void
  hasStarted: boolean
  setHasStarted: (v: boolean) => void
  priorUnits: string
  setPriorUnits: (v: string) => void
  degreeUnits: string
  setDegreeUnits: (v: string) => void
  onContinue: () => void
}) {
  return (
    <div className="stack" style={{ gap: 32, flex: 1 }}>
      <div className="stack center" style={{ gap: 16, alignItems: 'center' }}>
        <BoxBoy pose="readingStanding" width={120} />
        <h1 className="display center" style={{ fontSize: 26 }}>
          WHAT'S YOUR<br />CURRENT CGPA?
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 300, margin: 0, textAlign: 'center' }}>
          Not per-course grades. Just your overall CGPA so far.
        </p>
      </div>
      
      {hasStarted ? (
        <div style={{ maxWidth: 280, margin: '0 auto', width: '100%' }}>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={4}
            aria-invalid={currentCGPA !== '' && validateCGPA(currentCGPA) === null}
            value={currentCGPA}
            onChange={(e) => setCurrentCGPA(cleanCgpaInput(e.target.value))}
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
          <div className="t-12 center" style={{ marginTop: 8, color: currentCGPA !== '' && validateCGPA(currentCGPA) === null ? 'var(--u-red, #dc2626)' : 'var(--text3)' }}>
            {currentCGPA !== '' && validateCGPA(currentCGPA) === null ? 'Use a number from 0.00 to 5.00, like 3.75' : '0.00 – 5.00, up to two decimals'}
          </div>
          <div className="stack" style={{ gap: 12, marginTop: 24, textAlign: 'left' }}>
            <label className="t-13 w-6">
              Units completed so far
              <input type="number" min="0" max="400" inputMode="numeric" value={priorUnits} onChange={(e) => setPriorUnits(e.target.value)} className="input" style={{ marginTop: 6 }} />
            </label>
            <label className="t-13 w-6">
              Total units in your degree
              <input type="number" min="1" max="500" inputMode="numeric" value={degreeUnits} onChange={(e) => setDegreeUnits(e.target.value)} className="input" style={{ marginTop: 6 }} />
            </label>
            <div className="t-12 faint">An estimate is fine. We use these to work out the GPA you need from here.</div>
          </div>
        </div>
      ) : (
        <div className="stack center" style={{ gap: 12 }}>
          <p className="t-15 muted center" style={{ maxWidth: 300 }}>No problem. We'll plan from zero, so every course you take now counts toward your target.</p>
          <button
            type="button"
            onClick={() => setHasStarted(true)}
            className="btn btn--outline"
          >
            Actually, I have a CGPA
          </button>
        </div>
      )}
      {hasStarted && (
        <button type="button" onClick={() => setHasStarted(false)} className="btn btn--white btn--sm" style={{ alignSelf: 'center' }}>
          I don't have a CGPA yet
        </button>
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
      <div className="stack center" style={{ gap: 12, alignItems: 'center' }}>
        <h1 className="display center" style={{ fontSize: 24 }}>
          MARK YOUR<br />COURSES
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 320, margin: 0, textAlign: 'center' }}>
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
  current,
  onContinue
}: {
  target: number
  setTarget: (v: number) => void
  calculation: ReturnType<typeof getCGPALabel>
  current: number | null
  onContinue: () => void
}) {
  // A target has to be a step up: the lowest choice is just above where you are now.
  const min = current != null ? Math.min(5, (Math.floor(current * 10 + 1e-9) + 1) / 10) : 2.5
  useEffect(() => {
    if (target < min) setTarget(min)
  }, [target, min, setTarget])
  const shown = Math.max(target, min)
  const gain = current != null ? shown - current : null
  const words: Record<string, string> = {
    achievable: "You've got this. Steady, small steps will take you there, one course at a time.",
    stretch: "Ambitious, and within your reach. Stay consistent and keep showing up.",
    'very-difficult': "That is a big goal, and big goals are worth chasing. Start strong this semester and protect every course.",
    'out-of-reach': "That is more than your remaining units can give. Pick a little lower and build up from there.",
  }
  return (
    <div className="stack" style={{ gap: 32, flex: 1 }}>
      <div className="stack center" style={{ gap: 12, alignItems: 'center' }}>
        <h1 className="display center" style={{ fontSize: 24 }}>
          PICK YOUR<br />TARGET
        </h1>
        <p className="t-14 muted center" style={{ maxWidth: 300, margin: 0, textAlign: 'center' }}>
          Honest labels. No sugar-coating.
        </p>
      </div>
      
      <div style={{ padding: '0 16px' }}>
        <Slider label="CGPA target" min={min} max={5} step={0.1} value={shown} onChange={setTarget} />
        <div className="row between" style={{ marginTop: 8 }}>
          <span className="t-12 faint">{min.toFixed(1)}</span>
          <span className="t-12 faint">5.0</span>
        </div>
        {current != null && (
          <div className="t-12 faint center" style={{ marginTop: 6 }}>
            {min >= 5 ? `You are at ${current.toFixed(2)}. The top is 5.00, so keep it there.` : `You are at ${current.toFixed(2)} now. Targets start just above it.`}
          </div>
        )}
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
          {shown.toFixed(1)}
        </div>
        {gain != null && gain > 0.049 && (
          <div className="t-13 center w-7" style={{ marginTop: -8, marginBottom: 12, color: 'var(--green-deep)' }}>+{gain.toFixed(2)} above your CGPA now</div>
        )}
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
        <p className="t-14 center" style={{ margin: 0, fontWeight: 700 }}>{words[calculation.label] || calculation.description}</p>
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
  level,
  semester,
  onLockItIn,
  onAdjust,
  saving
}: {
  target: number
  currentCGPA: number
  unitsDone: number
  unitsRemaining: number
  calculation: ReturnType<typeof getCGPALabel>
  level: string | null
  semester: string | null
  onLockItIn: () => void
  onAdjust: () => void
  saving: boolean
}) {
  const semestersLeft = Math.max(1, Math.ceil(unitsRemaining / 18)) // Assume 18 units/semester
  const roadmap = calculateRoadmap(target, currentCGPA, unitsDone, unitsRemaining, semestersLeft)
  // Label each remaining semester with the student's real level and semester (from their
  // profile), and say whether the target is possible from where they stand now.
  const lvl = parseInt((level || '').replace(/\D/g, ''), 10)
  const startAbs = Number.isFinite(lvl) && lvl >= 100 && lvl <= 600 ? (lvl / 100 - 1) * 2 + (semester === 'Second Semester' ? 1 : 0) : null
  const labelFor = (i: number) => {
    if (startAbs == null) return `Semester ${i + 1}`
    const abs = startAbs + i
    return `${(Math.floor(abs / 2) + 1) * 100} Level · ${abs % 2 === 0 ? '1st' : '2nd'} semester`
  }
  const bestPossible = unitsRemaining > 0 ? Math.min(5, (currentCGPA * unitsDone + 5 * unitsRemaining) / Math.max(1, unitsDone + unitsRemaining)) : currentCGPA
  const possible = calculation.label !== 'out-of-reach'
  const whatIfGPA = 3.8
  const neededAfter = calculateWhatIf(target, currentCGPA, unitsDone, unitsRemaining, whatIfGPA, Math.min(18, unitsRemaining))
  
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
        <div className="t-13 faint" style={{ marginBottom: 6 }}>ROADMAP{startAbs != null ? ` · FROM ${labelFor(0).toUpperCase()}` : ''}</div>
        <div
          className="t-13 w-7"
          style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 12, background: possible ? 'var(--u-good-tint)' : 'var(--u-warn-tint)', color: 'var(--u-text)' }}
        >
          {possible
            ? `Possible. From where you are now, ${target.toFixed(1)} is reachable by the end of your degree.`
            : `Not possible with the units left. The most you could finish with is ${bestPossible.toFixed(2)}, so pick a little lower.`}
        </div>
        {roadmap.map((sem, i) => (
          <div key={i} className="row between" style={{ padding: '8px 0', borderBottom: i < roadmap.length - 1 ? '1px solid var(--u-hairline)' : 'none' }}>
            <div className="t-14 w-6">{labelFor(i)}</div>
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

