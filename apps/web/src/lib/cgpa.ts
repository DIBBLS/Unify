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
export function validateCGPA(value: string): number | null {
  const num = parseFloat(value)
  if (isNaN(num)) return null
  if (num < 0 || num > 5) return null
  return Math.round(num * 100) / 100
}

