// The on-screen layer drawn over the app while recording: caption bar, visible cursor, click ripple, highlight ring,
// full-screen title cards and a thin progress line. It lives on <html>, outside the React root, ignores the pointer,
// and survives full page loads (state is kept in sessionStorage).
export const OVERLAY = String.raw`
(() => {
  const FONT = '"IBM Plex Sans Arabic","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif';
  const CSS = ${"`"}
  #rq-root, #rq-root * { box-sizing: border-box; font-family: ${"${FONT}"}; }
  #rq-root { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; direction: rtl; }
  #rq-prog { position: absolute; top: 0; right: 0; height: 4px; background: #e0a526; width: 0; transition: width .8s ease; }
  #rq-cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 18px;
    padding: 14px 26px 16px; background: rgba(9,28,24,.95); border-top: 4px solid #e0a526; color: #fff;
    transform: translateY(110%); transition: transform .45s ease; }
  #rq-cap.on { transform: translateY(0); }
  #rq-cap.side { left: 22px; right: auto; bottom: 22px; width: 346px; flex-direction: column; align-items: flex-start; gap: 10px;
    border: 0; border-top: 4px solid #e0a526; border-radius: 16px; padding: 16px 18px 18px; box-shadow: 0 18px 44px rgba(0,0,0,.4);
    transform: translateX(-120%); }
  #rq-cap.side.on { transform: translateX(0); }
  #rq-cap.side .t { font-size: 19px; } #rq-cap.side .x { font-size: 15.5px; line-height: 1.7; }
  #rq-cap .badge { flex: none; min-width: 74px; text-align: center; padding: 6px 12px; border-radius: 999px;
    background: #e0a526; color: #1b1405; font-weight: 700; font-size: 13px; line-height: 1.3; }
  #rq-cap .body { flex: 1; min-width: 0; }
  #rq-cap .t { font-size: 21px; font-weight: 700; margin-bottom: 3px; color: #ffe6a8; }
  #rq-cap .x { font-size: 17px; line-height: 1.65; color: #eef3f0; }
  #rq-ring { position: absolute; border: 3px solid #e0a526; border-radius: 10px; box-shadow: 0 0 0 6px rgba(224,166,38,.28);
    opacity: 0; transition: opacity .25s, left .25s, top .25s, width .25s, height .25s; animation: rqpulse 1.1s ease-in-out infinite; }
  #rq-ring.on { opacity: 1; }
  @keyframes rqpulse { 50% { box-shadow: 0 0 0 11px rgba(224,166,38,.12); } }
  #rq-cur { position: absolute; width: 26px; height: 26px; left: 0; top: 0; opacity: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
  #rq-ripple { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
    background: rgba(224,166,38,.55); border: 2px solid #e0a526; opacity: 0; }
  #rq-ripple.go { animation: rqrip .6s ease-out; }
  @keyframes rqrip { from { opacity: 1; transform: scale(.6); } to { opacity: 0; transform: scale(4.2); } }
  #rq-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; text-align: center; padding: 40px 90px; color: #fff; opacity: 0; visibility: hidden; transition: opacity .6s ease, visibility .6s;
    background: radial-gradient(1200px 700px at 80% 10%, #1b7a62 0%, rgba(27,122,98,0) 60%), linear-gradient(135deg, #072b23, #0f5d4a 70%, #0b4a3b); }
  #rq-card.on { opacity: 1; visibility: visible; }
  #rq-card .logo { width: 84px; height: 84px; border-radius: 20px; background: #fff; color: #0f5d4a; font-size: 54px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
  #rq-card .kick { font-size: 20px; color: #ffd98a; letter-spacing: .02em; }
  #rq-card h1 { margin: 0; font-size: 50px; line-height: 1.3; font-weight: 800; }
  #rq-card .sub { font-size: 24px; color: #d4e6df; max-width: 900px; line-height: 1.6; }
  #rq-card ul { list-style: none; padding: 0; margin: 14px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 40px; text-align: right; max-width: 940px; }
  #rq-card.one ul { grid-template-columns: 1fr; max-width: 680px; }
  #rq-card li { font-size: 22px; line-height: 1.5; padding-right: 36px; position: relative; }
  #rq-card li::before { content: attr(data-n); position: absolute; right: 0; top: 2px; width: 26px; height: 26px; border-radius: 50%;
    background: #e0a526; color: #1b1405; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  ${"`"};
  const ARROW = '<svg id="rq-cur" viewBox="0 0 24 24"><path d="M3 2 L3 19.5 L7.6 15.2 L10.8 22 L13.4 20.8 L10.3 14.2 L16.8 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const store = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const load = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } };
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function build() {
    if (document.getElementById('rq-root')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.documentElement.appendChild(st);
    const root = document.createElement('div'); root.id = 'rq-root';
    root.innerHTML = '<div id="rq-prog"></div><div id="rq-ring"></div><div id="rq-cap"></div>' + ARROW + '<div id="rq-ripple"></div><div id="rq-card"></div>';
    document.documentElement.appendChild(root);
    const $ = (id) => document.getElementById(id);
    const api = {
      cap(o) {
        store('rq.cap', o);
        const el = $('rq-cap');
        if (!o) { el.classList.remove('on'); return; }
        el.innerHTML = '<div class="badge">' + esc(o.badge) + '</div><div class="body"><div class="t">' + esc(o.title) + '</div><div class="x">' + esc(o.text) + '</div></div>';
        el.classList.toggle('side', !!o.side);
        el.classList.add('on');
        if (o.p != null) $('rq-prog').style.width = o.p * 100 + '%';
      },
      card(o) {
        store('rq.card', o);
        const el = $('rq-card');
        if (!o) { el.classList.remove('on'); return; }
        el.className = o.bullets && o.bullets.length < 5 && !o.wide ? 'one' : '';
        el.innerHTML = (o.logo ? '<div class="logo">ر</div>' : '') + (o.kicker ? '<div class="kick">' + esc(o.kicker) + '</div>' : '') +
          '<h1>' + esc(o.title) + '</h1>' + (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') +
          (o.bullets ? '<ul>' + o.bullets.map((b, i) => '<li data-n="' + (i + 1) + '">' + esc(b) + '</li>').join('') + '</ul>' : '');
        void el.offsetWidth; el.classList.add('on');
        if (o.hideCap !== false) $('rq-cap').classList.remove('on');
      },
      ring(b) {
        const r = $('rq-ring');
        if (!b) { r.classList.remove('on'); return; }
        const pad = 5;
        r.style.left = b.x - pad + 'px'; r.style.top = b.y - pad + 'px';
        r.style.width = b.w + pad * 2 + 'px'; r.style.height = b.h + pad * 2 + 'px';
        r.classList.add('on');
      },
      cur(x, y) { const c = $('rq-cur'); c.style.opacity = 1; c.style.left = x - 3 + 'px'; c.style.top = y - 2 + 'px'; store('rq.cur', [x, y]); },
      ripple(x, y) { const r = $('rq-ripple'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); },
    };
    window.__rq = api;
    const cur = load('rq.cur'); if (cur) api.cur(cur[0], cur[1]);
    const cap = load('rq.cap'); if (cap) api.cap(cap);
    const card = load('rq.card'); if (card) api.card(card);
    const move = (e) => api.cur(e.clientX, e.clientY);
    document.addEventListener('mousemove', move, true);
    document.addEventListener('dragover', move, true);
    document.addEventListener('drag', (e) => { if (e.clientX || e.clientY) move(e); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
`;
