// Film layout behaviour. Without JavaScript every bar and title is a plain link
// and the play button opens YouTube; this adds scrubbing and in-page playback.
export const mmss = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const clamp = p => Math.max(0, Math.min(0.999, p));
export const frameAt = (frames, p) => frames[Math.min(frames.length - 1, Math.floor(clamp(p) * frames.length))];

function initReel(document) {
  const proj = document.querySelector('#proj'), lock = document.querySelector('#lock'), tc = document.querySelector('#tc');
  const rows = [...document.querySelectorAll('.film[data-film]')];
  if (!proj || !rows.length) return;
  const longest = Math.max(...rows.map(row => Number(row.dataset.duration)));
  for (const row of rows) {
    const bar = row.querySelector('.bar'), ph = row.querySelector('.ph');
    const duration = Number(row.dataset.duration), frames = JSON.parse(row.dataset.frames);
    // Start where the poster frame sits so the first hover continues from the still on screen.
    let p = (Number(row.dataset.poster) - 0.5) / frames.length;
    const show = () => {
      for (const other of rows) other.classList.toggle('on', other === row);
      ph.style.left = `${p * bar.clientWidth * duration / longest}px`;
      proj.src = frameAt(frames, p);
      lock.querySelector('.zh').textContent = row.dataset.zh;
      lock.querySelector('.en').textContent = row.dataset.en;
      tc.innerHTML = `<b>${mmss(p * duration)}</b> / ${mmss(duration)}`;
    };
    bar.addEventListener('pointermove', event => {
      const rect = bar.getBoundingClientRect();
      p = clamp((event.clientX - rect.left) / (rect.width * duration / longest)); show();
    });
    row.querySelector('.t').addEventListener('pointerenter', show);
    bar.addEventListener('focus', show);
    bar.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault(); p = clamp(p + (event.key === 'ArrowRight' ? 0.02 : -0.02)); show();
    });
    // Warm the frames once the visitor reaches for a film.
    bar.addEventListener('pointerenter', () => frames.forEach(src => { new Image().src = src; }), { once: true });
  }
}

export function embedUrl(id, start) {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('rel', '0');
  if (start > 0) url.searchParams.set('start', String(Math.round(start)));
  return url.href;
}

function initFilmPage(document) {
  const player = document.querySelector('.player[data-youtube]'), scrub = document.querySelector('.scrub');
  if (!player || !scrub) return;
  const play = player.querySelector('[data-play]'), poster = player.querySelector('img');
  const tip = document.querySelector('[data-tip]'), ph = scrub.querySelector('.ph');
  const duration = Number(scrub.dataset.duration), frames = JSON.parse(scrub.dataset.frames);
  let start = 0, p = 0;
  const startPlayer = () => {
    const frame = document.createElement('iframe');
    frame.src = embedUrl(player.dataset.youtube, start);
    frame.title = player.dataset.title;
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    frame.allowFullscreen = true;
    player.replaceChildren(frame);
  };
  play.addEventListener('click', event => { event.preventDefault(); startPlayer(); });
  const preview = () => {
    ph.style.left = `${p * scrub.clientWidth}px`;
    if (poster.isConnected) poster.src = frameAt(frames, p);
    tip.textContent = scrub.dataset.startLabel.replace('{t}', mmss(p * duration));
    scrub.setAttribute('aria-valuenow', String(Math.floor(p * duration)));
    scrub.setAttribute('aria-valuetext', mmss(p * duration));
  };
  const choose = () => {
    start = Math.round(p * duration);
    scrub.classList.add('set');
    if (play.isConnected) play.textContent = play.dataset.labelFrom.replace('{t}', mmss(start));
    else startPlayer();
  };
  scrub.addEventListener('pointermove', event => {
    if (scrub.classList.contains('set')) return;
    const rect = scrub.getBoundingClientRect();
    p = clamp((event.clientX - rect.left) / rect.width); preview();
  });
  scrub.addEventListener('pointerleave', () => scrub.classList.remove('set'));
  scrub.addEventListener('click', choose);
  scrub.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); return; }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault(); scrub.classList.remove('set');
    p = clamp(p + (event.key === 'ArrowRight' ? 0.02 : -0.02)); preview();
  });
}

if (typeof document !== 'undefined') { initReel(document); initFilmPage(document); }
