/**
 * CGPA Planner math (S17)
 * 
 * Formula: (T × total_units − current_CGPA × units_done) ÷ remaining_units
 * = GPA needed per semester to hit target
 */

export interface CGPACalculation {
  neededGPA: number
  label: 'out-of-reach' | 'very-difficult' | 'stretch' | 'achievable'
  color: string
  description: string
}

/**
 * Calculate GPA needed per semester to reach target
 */
export function calculateNeededGPA(
  target: number,
  current: number,
  unitsDone: number,
  unitsRemaining: number
): number {
  if (unitsRemaining <= 0) return 0
  
  const totalUnits = unitsDone + unitsRemaining
  const needed = (target * totalUnits - current * unitsDone) / unitsRemaining
  
  return Math.max(0, needed)
}

/**
 * Get honest label for target difficulty
 * Based on GPA needed per semester
 */
export function getCGPALabel(neededGPA: number): CGPACalculation {
  if (neededGPA > 5.0) {
    return {
      neededGPA,
      label: 'out-of-reach',
      color: 'var(--u-text-3)',
      description: 'Mathematically impossible with remaining units'
    }
  }
  
  if (neededGPA >= 4.5) {
    return {
      neededGPA,
      label: 'very-difficult',
      color: 'var(--u-amber)',
      description: 'Requires near-perfect performance every semester'
    }
  }
  
  if (neededGPA >= 3.5) {
    return {
      neededGPA,
      label: 'stretch',
      color: 'var(--u-good)',
      description: 'Challenging but possible with consistent effort'
    }
  }
  
  return {
    neededGPA,
    label: 'achievable',
    color: 'var(--u-good)',
    description: 'Realistic target with steady progress'
  }
}

/**
 * Calculate semester-by-semester roadmap
 * Shows GPA needed each semester if performance is consistent
 */
export function calculateRoadmap(
  target: number,
  current: number,
  unitsDone: number,
  unitsRemaining: number,
  semestersLeft: number
): Array<{ semester: number; gpa: number; cumulativeCGPA: number }> {
  const neededGPA = calculateNeededGPA(target, current, unitsDone, unitsRemaining)
  const unitsPerSemester = Math.ceil(unitsRemaining / semestersLeft)
  
  const roadmap: Array<{ semester: number; gpa: number; cumulativeCGPA: number }> = []
  
  let cumulativePoints = current * unitsDone
  let cumulativeUnits = unitsDone
  
  for (let i = 1; i <= semestersLeft; i++) {
    const semesterUnits = Math.min(unitsPerSemester, unitsRemaining - (cumulativeUnits - unitsDone))
    cumulativePoints += neededGPA * semesterUnits
    cumulativeUnits += semesterUnits
    
    const cumulativeCGPA = cumulativePoints / cumulativeUnits
    
    roadmap.push({
      semester: i,
      gpa: neededGPA,
      cumulativeCGPA: Math.min(5.0, cumulativeCGPA)
    })
  }
  
  return roadmap
}

/**
 * What-if calculator
 * "If you get X this semester, you'd need Y after"
 */
export function calculateWhatIf(
  target: number,
  current: number,
  unitsDone: number,
  unitsRemaining: number,
  thisSemesterGPA: number,
  thisSemesterUnits: number
): number {
  const afterThisSemester = {
    cgpa: (current * unitsDone + thisSemesterGPA * thisSemesterUnits) / (unitsDone + thisSemesterUnits),
    unitsDone: unitsDone + thisSemesterUnits,
    unitsRemaining: unitsRemaining - thisSemesterUnits
  }
  
  return calculateNeededGPA(
    target,
    afterThisSemester.cgpa,
    afterThisSemester.unitsDone,
    afterThisSemester.unitsRemaining
  )
}

/**
 * Validate CGPA input (0.00-5.00, 2 decimals)
 */
// A CGPA is a plain decimal from 0.00 to 5.00 with at most two decimal places.
// "3.5abc", "1e0", "-1", "5.01" and "" are all rejected (never silently rounded).
export const CGPA_PATTERN = /^(?:[0-4](?:\.\d{1,2})?|5(?:\.0{1,2})?)$/

export function validateCGPA(value: string): number | null {
  const t = (value ?? '').trim()
  if (!CGPA_PATTERN.test(t)) return null
  return Math.round(Number(t) * 100) / 100
}

/** Keeps a CGPA field clean while typing: digits and one dot, one digit before it, two after, never above 5. */
export function cleanCgpaInput(raw: string): string {
  let s = (raw ?? '').replace(/[^0-9.]/g, '')
  const dot = s.indexOf('.')
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  const [whole, frac] = s.split('.')
  s = whole.slice(0, 1) + (frac !== undefined ? '.' + frac.slice(0, 2) : '')
  if (Number(s) > 5) s = '5'
  return s
}

