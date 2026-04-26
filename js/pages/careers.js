(function(){
  const saved = localStorage.getItem('unify-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if(btn) btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
})();
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('unify-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
}
