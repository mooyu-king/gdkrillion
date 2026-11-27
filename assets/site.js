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
function openDialog(trigger, playUrl) {
  const isShare = Boolean(playUrl);
  const installed = installCompleted || standalone.matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  opener = trigger;
  sharedUrl = playUrl ?? siteUrl;
  dialogTitle.textContent = isShare ? 'Share this game' : 'Install GD Krillion';
  installHelp.textContent = isShare ? 'Send the play link to a friend.'
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
    openDialog(button);
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

const embedUrls = {
  gd: 'https://crowdict.com/embed/gd-krillion',
  medical: 'https://crowdict.com/embed/medical-krillion'
};

function setupGame(game, source) {
  const gameTitle = game.querySelector('h1').textContent;
  const shareUrl = new URL(location.pathname + '#play', siteUrl).href;
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
    frame.title = gameTitle + ' trivia game';
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
    frame.src = source;
    setFeedback('Opening the game…', false);
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
        await navigator.share({ title: gameTitle, url: shareUrl });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    openDialog(share, shareUrl);
  });
}

const game = document.querySelector('#play');
if (game) setupGame(game, embedUrls[game.dataset.game]);

const menu = document.querySelector('#play-more');
document.addEventListener('click', (event) => {
  if (menu.open && (!menu.contains(event.target) || event.target.closest('a'))) menu.open = false;
});
menu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

const pauseUpdates = document.querySelector('#pause-updates');
const updatesWindow = document.querySelector('.updates-window');
updatesWindow?.addEventListener('focusin', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  const [title, message] = link.children;
  updatesWindow.querySelector('.updates-focus').textContent = `${title.textContent} · ${message.textContent}`;
});
pauseUpdates?.addEventListener('click', () => {
  const paused = pauseUpdates.getAttribute('aria-pressed') === 'false';
  const label = paused ? 'Resume game updates' : 'Pause game updates';
  pauseUpdates.setAttribute('aria-pressed', String(paused));
  pauseUpdates.setAttribute('aria-label', label);
  pauseUpdates.title = label;
  pauseUpdates.querySelector('[data-pause-icon]').hidden = paused;
  pauseUpdates.querySelector('[data-play-icon]').hidden = !paused;
  pauseUpdates.closest('.updates').classList.toggle('updates-paused', paused);
});

const drill = document.querySelector('#medical-drill');
if (drill) {
  const feedback = drill.querySelector('#medical-feedback');
  const initialMessage = feedback.textContent;
  drill.hidden = false;
  drill.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(drill);
    const goal = values.get('goal');
    const answer = values.get('answer');
    if (!answer) return;
    if (answer === 'patella') {
      feedback.textContent = 'Patella is the kneecap, outside the forearm. Popularity only matters after an answer fits.';
      return;
    }
    const answerLabel = answer === 'radius' ? 'Radius' : 'Ulna';
    const winner = goal === 'rare' ? 'Ulna' : 'Radius';
    const mode = goal === 'rare' ? 'Rare' : 'Crowd';
    const sample = ' In this sample, 72 people chose radius and 28 chose ulna.';
    feedback.textContent = winner === answerLabel
      ? `${answerLabel} fits the prompt and leads in ${mode}.${sample}`
      : `${answerLabel} fits the prompt. ${winner} is the stronger ${mode} pick.${sample}`;
  });
  const clearFeedback = () => { feedback.textContent = initialMessage; };
  drill.addEventListener('change', clearFeedback);
  drill.addEventListener('reset', clearFeedback);
}

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
