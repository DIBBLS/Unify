if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'activated') {
              // New SW activated — show update banner
              showUpdateBanner();
            }
          });
        });
      })
      .catch(() => {});

    // Also reload automatically if controller changes (new SW took over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

function showUpdateBanner() {
  if (document.getElementById('sw-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
    'background:#16a34a', 'color:#fff', 'padding:12px 20px', 'border-radius:24px',
    'font-family:DM Sans,sans-serif', 'font-size:14px', 'font-weight:500',
    'box-shadow:0 4px 20px rgba(0,0,0,.25)', 'z-index:9999',
    'display:flex', 'align-items:center', 'gap:12px', 'white-space:nowrap',
    'cursor:pointer'
  ].join(';');
  banner.innerHTML = '🔄 New update available — <strong style="margin-left:4px">tap to refresh</strong>';
  banner.onclick = () => window.location.reload();
  document.body.appendChild(banner);
}
