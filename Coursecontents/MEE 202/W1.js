function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('unify-theme', next);
  document.querySelector('.theme-toggle').textContent = next === 'dark' ? 'Toggle Light' : 'Toggle Dark';
}
(function() {
  const saved = localStorage.getItem('unify-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    if (saved === 'dark') document.querySelector('.theme-toggle').textContent = 'Toggle Light';
  }
})();
