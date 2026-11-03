import { useNavigate } from 'react-router-dom';

/**
 * Prototype navigation between screens by their Figma ID (S01, L07, C02…).
 * In apps/web, replace each go('S02') with the real route from README's route map.
 */
export function useGo() {
  const navigate = useNavigate();
  return (id: string) => navigate(`/screens/${id}`);
}

export function useBack() {
  const navigate = useNavigate();
  return () => navigate(-1);
}
