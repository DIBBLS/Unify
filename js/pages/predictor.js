(function() {
  // Apply theme before anything renders
  var t = localStorage.getItem('unify-theme') ||
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  var btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';

  // Hard failsafe — hide overlay after 5s regardless of module state
  setTimeout(function() {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }, 5000);
})();
