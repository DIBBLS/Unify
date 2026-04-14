/**
 * Unify — Shared Theme Toggle
 * Include this script in every page's <head> (not deferred).
 * Reads/writes localStorage key 'unify-theme'.
 */

(function () {
  const KEY = 'unify-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }

  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    // Respond to OS-level changes when user hasn't made an explicit choice
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem(KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Run immediately so there's no flash of wrong theme
  initTheme();

  // Re-sync button label once DOM is ready (for pages that inject the button late)
  document.addEventListener('DOMContentLoaded', function () {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(theme);
  });

  // Expose globally for onclick="toggleTheme()" in HTML
  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    applyTheme(next);
  };
})();
