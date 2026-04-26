function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('unify-theme', isDark ? 'light' : 'dark');
  document.querySelector('.theme-toggle').textContent = isDark ? 'Dark mode' : 'Light mode';
}
(function() {
  const saved = localStorage.getItem('unify-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelector('.theme-toggle').textContent = 'Light mode';
  }
})();
