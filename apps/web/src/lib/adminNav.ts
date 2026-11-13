import { Users, UserCheck, GraduationCap, LibraryBig, BookOpen, Building2, CalendarDays, Megaphone, Cpu, BarChart3, AlertTriangle, Scale, LayoutGrid, Activity, Map as MapIcon, Radio, Bug } from 'lucide-react';

// One admin hub. Each section has its own URL (/admin/users …) so links,
// refresh and the back button behave; /admin is the Overview. Grouped by job.
export const GROUPS = [
  { label: null, items: [{ id: 'overview', title: 'Overview', icon: LayoutGrid }] },
  { label: 'People', items: [
    { id: 'users', title: 'Users & roles', icon: Users },
    { id: 'requests', title: 'Staff requests', icon: UserCheck },
    { id: 'hoc', title: 'Class reps (HOC)', icon: GraduationCap },
  ] },
  { label: 'Academics', items: [
    { id: 'courses', title: 'Courses per level', icon: LibraryBig },
    { id: 'content', title: 'All content', icon: BookOpen },
    { id: 'unis', title: 'Universities', icon: Building2 },
    { id: 'structure', title: 'Faculties & departments', icon: Building2 },
    { id: 'session', title: 'Academic session', icon: CalendarDays },
    { id: 'guide', title: 'Student guide', icon: MapIcon },
  ] },
  { label: 'Platform', items: [
    { id: 'announce', title: 'Announce', icon: Megaphone },
    { id: 'livewire', title: 'Live wire', icon: Radio },
    { id: 'models', title: 'AI models', icon: Cpu },
  ] },
  { label: 'Health', items: [
    { id: 'performance', title: 'Live performance', icon: Activity },
    { id: 'analytics', title: 'Analytics', icon: BarChart3 },
    { id: 'bugs', title: 'Bug reports', icon: Bug },
    { id: 'errors', title: 'App errors', icon: AlertTriangle },
    { id: 'capaudit', title: 'Cap audit', icon: Scale },
  ] },
];
export const SECTION_IDS = GROUPS.flatMap((g) => g.items.map((i) => i.id));

