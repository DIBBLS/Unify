(function(){const saved=localStorage.getItem('unify-theme');if(saved){document.documentElement.setAttribute('data-theme',saved);const b=document.getElementById('theme-btn');if(b)b.textContent=saved==='dark'?'☀ Light':'☾ Dark';}})();
function toggleTheme(){const cur=document.documentElement.getAttribute('data-theme');const nxt=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',nxt);localStorage.setItem('unify-theme',nxt);document.getElementById('theme-btn').textContent=nxt==='dark'?'☀ Light':'☾ Dark';}

// PWA nav fix: keep week-to-week navigation inside the Learn.html SPA.
// All Coursecontents/*/W*.html pages load this file, so this one listener
// patches every week page without touching each file individually.
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.indexOf('/Coursecontents/') === -1) return;

  // Find the course code from the "← Back to Course" link
  var backA = document.querySelector('a[href*="learn.html"]')
           || document.querySelector('a[href*="Learn.html"]');
  if (!backA) return;
  var cm = backA.getAttribute('href').match(/[?&]course=([^&#]+)/i);
  if (!cm) return;
  var code = decodeURIComponent(cm[1].replace(/\+/g,' '));
  var enc  = encodeURIComponent(code);

  function learnWeekHref(n) {
    return '../../Learn.html?course=' + enc + '&name=' + enc + '&week=' + n;
  }

  document.querySelectorAll('a[href]').forEach(function(a) {
    var h = a.getAttribute('href');
    // Redirect sibling W*.html or legacy *week*.html links back through SPA
    var wm = h.match(/\bW(\d+)\.html\b/) || h.match(/\bweek(\d+)\.html\b/i);
    if (wm) {
      a.setAttribute('href', learnWeekHref(parseInt(wm[1], 10)));
      a.removeAttribute('target');
      return;
    }
    // Fix lowercase learn.html → Learn.html (Linux file system is case-sensitive)
    if (/learn\.html/i.test(h) && h.indexOf('Learn.html') === -1) {
      a.setAttribute('href', h.replace(/learn\.html/ig, 'Learn.html'));
    }
  });
});
