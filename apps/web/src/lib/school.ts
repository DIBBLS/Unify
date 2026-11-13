import { useEffect, useState } from 'react';
import { apiFetch } from './api';

// Faculties and departments for every picker (onboarding, Me, lecturer setup,
// admin roles, admin pickers). Admins manage them in Admin › Faculties &
// departments; this reads /v1/school/structure once per app session. Until it
// answers (or if it can't), the built-in list below is used, which matches
// the seeded data, so a picker is never empty.
export type SchoolDepartment = { id: string; name: string; code: string; active: boolean; sort: number };
export type SchoolFaculty = { id: string; name: string; university: string; status: 'open' | 'soon' | 'later'; sort: number; departments: SchoolDepartment[] };

const ENG = 'Faculty of Engineering';
const dep = (name: string, code: string, sort: number): SchoolDepartment => ({ id: name, name, code, active: true, sort });
const fac = (name: string, status: SchoolFaculty['status'], sort: number, departments: SchoolDepartment[] = []): SchoolFaculty => ({ id: name, name, university: 'Lagos State University', status, sort, departments });
export const FALLBACK: SchoolFaculty[] = [
  fac(ENG, 'open', 0, [
    dep('Electronic & Computer Engineering', 'ECE', 0),
    dep('Mechanical Engineering', 'MEE', 1),
    dep('Industrial & Petroleum Engineering', 'IPE', 2),
    dep('Chemical & Polymer Engineering', 'CPE', 3),
    dep('Civil Engineering', 'CVE', 4),
    dep('Aerospace Engineering', 'ASE', 5),
  ]),
  fac('Faculty of Environmental Sciences', 'soon', 1),
  fac('School of Agriculture', 'soon', 2),
  ...['Faculty of Arts', 'Faculty of Communication and Media Studies', 'Faculty of Education', 'Faculty of Law', 'Faculty of Management Sciences', 'Faculty of Science', 'Faculty of Social Sciences', 'Faculty of Transport', 'College of Medicine'].map((n, i) => fac(n, 'later', 3 + i)),
];

let cached: SchoolFaculty[] | null = null;
let inflight: Promise<SchoolFaculty[]> | null = null;

export function loadSchool(force = false): Promise<SchoolFaculty[]> {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight || force) {
    inflight = apiFetch<{ faculties: SchoolFaculty[] }>('/v1/school/structure')
      .then((r) => { cached = r.faculties?.length ? r.faculties : FALLBACK; return cached; })
      .catch(() => cached || FALLBACK)
      .finally(() => { inflight = null; });
  }
  return inflight;
}
export function forgetSchool() { cached = null; }

export function useSchool() {
  const [faculties, setFaculties] = useState<SchoolFaculty[]>(cached || FALLBACK);
  useEffect(() => {
    let gone = false;
    void loadSchool().then((f) => { if (!gone) setFaculties(f); });
    return () => { gone = true; };
  }, []);
  const open = faculties.filter((f) => f.status === 'open');
  return {
    faculties,
    openFaculties: open,
    // Every active department of the open faculties, in order.
    departments: open.flatMap((f) => f.departments),
    facultyOf: (department: string) => faculties.find((f) => f.departments.some((d) => d.name === department))?.name || '',
  };
}
