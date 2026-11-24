const siteUrl = 'https://gdkrillion.online/';
const dialog = document.querySelector('#site-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const installHelp = document.querySelector('#install-help');
const nativeInstall = document.querySelector('#native-install');
const copyFallback = document.querySelector('#copy-fallback');
const dialogStatus = document.querySelector('#dialog-status');
const installButton = document.querySelector('#install-app');
const standalone = matchMedia('(display-mode: standalone)');
const track = (name, props) => {
  if (location.hostname !== 'gdkrillion.online') return;
  try { window.plausible?.(name, { props }); } catch { /* 统计失败不阻断交互 */ }
};

let pendingInstall;
let installCompleted = false;
let opener;
let sharedUrl = siteUrl;
function openDialog(kind, trigger) {
  const isShare = kind === 'share';
  const installed = installCompleted || standalone.matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  opener = trigger;
  sharedUrl = isShare ? siteUrl + '#play' : siteUrl;
  dialogTitle.textContent = isShare ? 'Share the daily game' : 'Install GD Krillion';
  installHelp.textContent = isShare ? 'Send the play link to a friend for the next daily set.'
    : installed ? 'Open GD Krillion from your home screen or app launcher.'
    : pendingInstall ? 'Install the app for a quick way back to the daily game.'
    : ios ? 'In Safari, tap Share, then Add to Home Screen. You can also bookmark this page.'
    : 'Open your browser menu and choose Install or Add to Home Screen when available. You can also bookmark this site.';
  nativeInstall.hidden = isShare || !pendingInstall || installed;
  copyFallback.hidden = true;
  copyFallback.querySelector('input').value = sharedUrl;
  dialogStatus.textContent = '';
  dialog.showModal();
  if (!isShare && nativeInstall.hidden) track('PWA Install Help');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pendingInstall = event;
  if (dialog.open && sharedUrl === siteUrl) nativeInstall.hidden = false;
  track('PWA Install Available');
});
window.addEventListener('appinstalled', () => {
  installCompleted = true;
  pendingInstall = undefined;
  nativeInstall.hidden = true;
  if (dialog.open && sharedUrl === siteUrl) dialogStatus.textContent = 'App installed.';
  track('PWA Installed');
});
for (const button of [installButton, ...document.querySelectorAll('[data-open-install]')]) {
  button.addEventListener('click', () => {
    track('PWA Install Click');
    openDialog('install', button);
  });
}
nativeInstall.addEventListener('click', async () => {
  const prompt = pendingInstall;
  if (!prompt) return;
  pendingInstall = undefined;
  nativeInstall.hidden = true;
  try {
    await prompt.prompt();
    const result = await prompt.userChoice;
    track('PWA Install Result', { outcome: result.outcome });
    if (dialog.open && sharedUrl === siteUrl && !installCompleted) {
      dialogStatus.textContent = result.outcome === 'accepted'
        ? 'Installation requested.' : 'Installation closed. You can still bookmark this page.';
    }
  } catch {
    track('PWA Install Result', { outcome: 'unavailable' });
    if (dialog.open && sharedUrl === siteUrl) dialogStatus.textContent = 'Use your browser menu to install or bookmark this page.';
  }
});
document.querySelector('#copy-link').addEventListener('click', async () => {
  const url = sharedUrl;
  try {
    await navigator.clipboard.writeText(url);
    if (url === siteUrl) track('PWA Link Copied');
    if (dialog.open && sharedUrl === url) dialogStatus.textContent = 'Link copied.';
  } catch {
    if (!dialog.open || sharedUrl !== url) return;
    copyFallback.hidden = false;
    const input = copyFallback.querySelector('input');
    input.focus();
    input.select();
    dialogStatus.textContent = 'Copy the selected link using your browser or keyboard.';
  }
});
dialog.addEventListener('close', () => opener?.focus());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
});

track('PWA Page View', { display: standalone.matches || navigator.standalone ? 'app' : 'browser' });
try {
  if (!sessionStorage.getItem('gdk-session')) {
    sessionStorage.setItem('gdk-session', '1');
    track('PWA Session');
  }
} catch { /* 浏览器可能禁止会话存储 */ }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => track('PWA Service Worker Error'));
}

function setupGame(game) {
  const cover = game.querySelector('#game-cover');
  const start = game.querySelector('#start-game');
  const slot = game.querySelector('#embed-slot');
  const status = game.querySelector('#game-status');
  const retry = game.querySelector('#retry-game');
  const close = game.querySelector('[data-game-action="close"]');
  const fullscreen = game.querySelector('[data-game-action="expand"]');
  const share = game.querySelector('[data-game-action="share"]');
  let loadTimer;
  const setFeedback = (message, canRetry) => {
    status.textContent = message;
    retry.hidden = !canRetry;
  };

  function loadGame() {
    if (!navigator.onLine) {
      if (slot.firstElementChild) {
        returnToCover();
      }
      setFeedback('You’re offline. Reconnect to play this daily game.', true);
      return;
    }
    clearTimeout(loadTimer);
    const frame = document.createElement('iframe');
    frame.title = 'GD Krillion daily trivia game';
    frame.allow = 'fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const update = (message) => {
      if (slot.firstElementChild !== frame) return;
      clearTimeout(loadTimer);
      setFeedback(message, true);
    };
    frame.addEventListener('load', () => update('Blank game panel? Try reloading the game.'), { once: true });
    frame.addEventListener('error', () => update('The game could not load. Check your connection and retry.'), { once: true });
    frame.src = 'https://crowdict.com/embed/gd-krillion';
    setFeedback('Opening the daily game…', false);
    cover.hidden = true;
    close.disabled = false;
    slot.replaceChildren(frame);
    frame.focus();
    loadTimer = setTimeout(() => setFeedback('The game is taking longer than expected. You can reload it.', true), 15000);
  }
  function returnToCover() {
    clearTimeout(loadTimer);
    slot.replaceChildren();
    cover.hidden = false;
    setFeedback('', false);
    start.focus();
    close.disabled = true;
  }
  start.addEventListener('click', loadGame);
  retry.addEventListener('click', loadGame);
  close.addEventListener('click', returnToCover);

  const fullIcon = fullscreen.querySelector('path');
  const expandPath = fullIcon.getAttribute('d');
  const shrinkPath = 'M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4';
  function setExpanded(expanded) {
    const label = expanded ? 'Exit full screen' : 'Full screen';
    game.classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('game-expanded', expanded);
    fullscreen.setAttribute('aria-pressed', String(expanded));
    fullscreen.setAttribute('aria-label', label);
    fullscreen.title = label;
    fullIcon.setAttribute('d', expanded ? shrinkPath : expandPath);
  }
  fullscreen.addEventListener('click', async () => {
    if (document.fullscreenElement === game) await document.exitFullscreen();
    else if (game.classList.contains('is-expanded')) setExpanded(false);
    else {
      try { await game.requestFullscreen(); } catch { setExpanded(true); }
    }
  });
  document.addEventListener('fullscreenchange', () => setExpanded(document.fullscreenElement === game));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog.open && !document.fullscreenElement && game.classList.contains('is-expanded')) {
      setExpanded(false);
      fullscreen.focus();
    }
  });
  share.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'GD Krillion', url: siteUrl + '#play' });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    openDialog('share', share);
  });
}

const game = document.querySelector('#play');
if (game) setupGame(game);

const practice = document.querySelector('#practice');
if (practice) {
  const results = practice.querySelector('#sample-results');
  const verdict = practice.querySelector('#sample-verdict');
  const entries = Array.from(results.children);
  function updatePractice(mode) {
    const order = mode === 'crowd' ? [...entries].reverse() : entries;
    const [name, picks] = order[0].children;
    const answer = document.createElement('strong');
    answer.textContent = name.textContent;
    results.replaceChildren(...order);
    verdict.replaceChildren(answer, ` leads in ${mode === 'crowd' ? 'Crowd' : 'Rare'} with ${picks.textContent}.`);
  }
  practice.addEventListener('change', (event) => {
    if (event.target.name === 'practice-mode') updatePractice(event.target.value);
  });
  window.addEventListener('pageshow', () => updatePractice(practice.querySelector('input:checked').value));
}
