import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function DesktopShell() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  if (!isDesktop) return <Outlet />;
  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">Sidebar</aside>
      <main className="desktop-main"><Outlet /></main>
    </div>
  );
}
