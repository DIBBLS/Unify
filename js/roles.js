// roles.js — role helpers for Unify admin/class-rep system

export function normField(s) {
  return String(s || '').trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ');
}

export function getRole(profile) {
  if (!profile) return 'student';
  return profile.role || (profile.isAdmin ? 'super_admin' : 'student');
}

export function canManageCourses(role) {
  return role === 'super_admin' || role === 'academic_lead';
}

export function canPostUpdates(role) {
  return role === 'super_admin' || role === 'academic_lead' || role === 'class_rep';
}

export function canManageTimetable(role) {
  return role === 'super_admin' || role === 'class_rep';
}

export function canGrantAccess(role) {
  return role === 'super_admin';
}

export function canUploadContent(role) {
  return role === 'super_admin' || role === 'academic_lead';
}

export function getAssignment(profile) {
  return {
    faculty: profile?.assignedFaculty || null,
    department: profile?.assignedDepartment || null,
    level: profile?.assignedLevel || null,
    semester: profile?.assignedSemester || null,
  };
}

export function matchesClass(profile, entry) {
  if (entry.targetDepartment && normField(profile.department) !== normField(entry.targetDepartment)) return false;
  if (entry.targetLevel && normField(profile.level) !== normField(entry.targetLevel)) return false;
  return true;
}
