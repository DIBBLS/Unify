import { Navigate } from 'react-router-dom';
import { ROUTES } from '../lib/routes';

// Kept so old links still work. Lecturers and class reps start an online class from Take
// attendance (the Online tab); students join from the Timetable.
export default function OnlineClassRoute() {
  return <Navigate to={`${ROUTES.scanner}?online=1`} replace />;
}
