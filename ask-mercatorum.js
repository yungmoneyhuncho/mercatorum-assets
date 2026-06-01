/* Mercatorum — "Ask Mercatorum" chat assistant
   ----------------------------------------------------------------
   Self-contained widget: injects its own CSS, launcher, and panel.
   Features:
     • Conversation memory (remembers the commodity / topic in play)
     • Live unit conversion (parses "500 MT canola to bushels" etc.)
     • Buyer-intent detection + lead capture (email → routes to desk)
     • Session persistence (sessionStorage; survives page navigation)
     • Adaptive quick-reply chips that follow the conversation
     • Greeting nudge bubble to drive first engagement
   Swap to a real LLM later: set window.MERCATORUM_CHAT_ENDPOINT to a
   URL that accepts {messages:[...]} and returns {reply:"..."} — the
   widget will POST there and fall back to the local brain on error.
*/
(function(){
  if (window.__mercatorum_chat) return;
  window.__mercatorum_chat = true;

  /* ===== Global polish (applied site-wide via this universal script) ===== */
  const globalCss = document.createElement('style');
  globalCss.textContent = `
    html{ scroll-behavior:smooth }
    html, body{ overflow-x:clip }
    :target{ scroll-margin-top:118px }
    a[href^="#"]{ scroll-margin-top:118px }
    @media (prefers-reduced-motion: reduce){ html{ scroll-behavior:auto } }

    /* ---- Footer link hover: underline hugs the text, not the whole column ---- */
    .m-footer__col a{ width:fit-content; max-width:100%; transition:color .18s ease, opacity .18s ease; }
    .m-footer__col a:hover{ border-bottom:0 !important; opacity:1 !important; color:var(--m-highlight) !important; text-decoration:underline !important; text-underline-offset:3px; text-decoration-thickness:1px; }

    /* ---- Mobile navigation (hamburger + drawer) ---- */
    .m-nav-burger{ display:none; }
    @media (max-width:900px){
      .m-glass-nav__links{ display:none !important; }
      .m-glass-nav__cta{ display:none !important; }
      .m-glass-nav{ gap:10px !important; padding:8px 10px 8px 8px !important; max-width:calc(100vw - 24px); }
      .m-nav-burger{
        display:inline-flex; align-items:center; justify-content:center; flex:none;
        width:42px; height:42px; margin-left:4px; border:0; cursor:pointer;
        border-radius:50%; background:rgba(245,241,232,0.12);
        border:1px solid rgba(245,241,232,0.22); -webkit-tap-highlight-color:transparent;
      }
      .m-nav-burger span{ position:relative; width:18px; height:2px; background:#F5F1E8; border-radius:2px; transition:transform .25s, opacity .2s; display:block; }
      .m-nav-burger span::before, .m-nav-burger span::after{ content:""; position:absolute; left:0; width:18px; height:2px; background:#F5F1E8; border-radius:2px; transition:transform .25s, opacity .2s; }
      .m-nav-burger span::before{ top:-6px } .m-nav-burger span::after{ top:6px }
      .m-nav-burger.is-open span{ background:transparent }
      .m-nav-burger.is-open span::before{ transform:translateY(6px) rotate(45deg) }
      .m-nav-burger.is-open span::after{ transform:translateY(-6px) rotate(-45deg) }
    }
    .m-nav-drawer{
      position:fixed; top:84px; left:12px; right:12px; z-index:49;
      background:rgba(31,58,46,0.94);
      backdrop-filter:blur(22px) saturate(160%); -webkit-backdrop-filter:blur(22px) saturate(160%);
      border:1px solid rgba(245,241,232,0.18); border-radius:18px;
      box-shadow:0 24px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(245,241,232,0.12);
      padding:10px; display:flex; flex-direction:column; gap:2px;
      opacity:0; transform:translateY(-12px); pointer-events:none;
      transition:opacity .24s ease, transform .24s cubic-bezier(.2,.8,.2,1);
    }
    .m-nav-drawer.is-open{ opacity:1; transform:translateY(0); pointer-events:auto }
    .m-nav-drawer a{
      color:#F5F1E8; text-decoration:none; font-family:'Inter',sans-serif;
      font-size:14px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase;
      padding:15px 18px; border-radius:12px; transition:background .18s; display:block;
    }
    .m-nav-drawer a:hover, .m-nav-drawer a.is-active{ background:rgba(245,241,232,0.1) }
    .m-nav-drawer a.is-active{ color:#A88746 }
    .m-nav-drawer__cta{ margin-top:6px; background:#7A1E1E !important; text-align:center; color:#F5F1E8 !important; border-radius:999px !important; }
    .m-nav-drawer__cta:hover{ background:#5A1414 !important }
    @media (min-width:901px){ .m-nav-drawer, .m-nav-burger{ display:none !important } }

    /* ---- small-screen overflow guards ---- */
    @media (max-width:760px){ .m-footer__top{ gap:28px 20px !important } }
    /* CSS-grid min-width:auto trap — let grid items shrink instead of overflowing */
    .m-fld, .m-grid-2 > *, .m-grid-3 > *{ min-width:0 }
    @media (max-width:680px){
      .m-grid-2, .m-grid-3{ grid-template-columns:1fr !important }
      .m-desk-grid{ grid-template-columns:1fr !important }
      .m-desk-info{ grid-template-columns:1fr 1fr !important }
    }
    @media (max-width:420px){
      .m-loi{ padding-left:18px !important; padding-right:18px !important }
    }
    /* hidden radio inputs shouldn't have a wide box */
    .m-fld__radio input{ width:1px !important; height:1px !important }
    /* globe: square frame on mobile so the sphere fills it */
    @media (max-width:760px){ .m-globe-frame{ aspect-ratio:1/1 !important; min-height:340px !important } }
  `;
  document.head.appendChild(globalCss);

  /* ===== Build mobile hamburger nav from the existing glass nav ===== */
  function buildMobileNav(){
    const nav = document.querySelector('.m-glass-nav');
    if (!nav || nav.querySelector('.m-nav-burger')) return;
    const links = nav.querySelector('.m-glass-nav__links');
    const cta   = nav.querySelector('.m-glass-nav__cta');

    // burger button inside the nav (right side)
    const burger = document.createElement('button');
    burger.className = 'm-nav-burger';
    burger.setAttribute('aria-label','Menu');
    burger.setAttribute('aria-expanded','false');
    burger.innerHTML = '<span></span>';
    nav.appendChild(burger);

    // drawer
    const drawer = document.createElement('nav');
    drawer.className = 'm-nav-drawer';
    drawer.setAttribute('aria-label','Mobile menu');
    if (links){
      links.querySelectorAll('a').forEach(a => {
        const c = a.cloneNode(true);
        drawer.appendChild(c);
      });
    }
    if (cta){
      const c = cta.cloneNode(true);
      c.classList.add('m-nav-drawer__cta');
      drawer.appendChild(c);
    }
    document.body.appendChild(drawer);

    function close(){ drawer.classList.remove('is-open'); burger.classList.remove('is-open'); burger.setAttribute('aria-expanded','false'); }
    function toggle(){
      const open = !drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    burger.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });
    drawer.addEventListener('click', (e)=>{ if (e.target.tagName === 'A') close(); });
    document.addEventListener('click', (e)=>{ if (!drawer.contains(e.target) && !burger.contains(e.target)) close(); });
    window.addEventListener('resize', ()=>{ if (window.innerWidth > 900) close(); });
  }
  if (document.readyState !== 'loading') buildMobileNav();
  else document.addEventListener('DOMContentLoaded', buildMobileNav);

  /* ===== Pre-fill the LOI form from a chat-built inquiry (contact page) ===== */
  function prefillLOIFromLead(){
    let d;
    try { const raw = localStorage.getItem('mercatorum_lead'); if (!raw) return; d = JSON.parse(raw); } catch(e){ return; }
    const f = document.getElementById('loi-form');
    if (!f){ return; } // not on the contact page
    const set = (name, val) => { if (!val) return; const el = f.querySelector('[name="'+name+'"]'); if (el && !el.value) el.value = val; };
    set('loi_product', d.commodity);
    set('loi_qty', d.volume);
    set('loi_destport', d.destination);
    set('loi_name', d.name);
    set('loi_email', d.email);
    set('loi_company', d.company);
    if (d.incoterm){
      const sel = f.querySelector('[name="loi_incoterm"]');
      if (sel) Array.from(sel.options).forEach(o => { if (o.value.toUpperCase() === String(d.incoterm).toUpperCase()) sel.value = o.value; });
    }
    if (d.side){
      const notes = f.querySelector('[name="loi_notes"]');
      if (notes && !notes.value) notes.value = d.side + ' inquiry — started via the Ask Mercatorum assistant.';
    }
    // make sure the LOI tab is showing
    const loiTab = document.querySelector('[data-tab=loi]');
    if (loiTab) loiTab.click();
    // friendly banner above the form
    const head = f.closest('.m-loi') ? f.closest('.m-loi').querySelector('.m-loi__head') : null;
    if (head && !document.getElementById('m-prefill-note')){
      const note = document.createElement('div');
      note.id = 'm-prefill-note';
      note.style.cssText = 'margin-top:18px;padding:12px 16px;background:rgba(31,58,46,0.06);border:1px solid rgba(168,135,70,0.4);border-radius:8px;font-size:13px;color:#1F3A2E;line-height:1.5';
      note.innerHTML = '✓ We carried over the details from your chat. Review and complete the rest, then submit.';
      head.insertAdjacentElement('afterend', note);
    }
    // one-shot: clear so a refresh doesn't re-apply
    try { localStorage.removeItem('mercatorum_lead'); } catch(e){}
  }
  if (document.readyState !== 'loading') prefillLOIFromLead();
  else document.addEventListener('DOMContentLoaded', prefillLOIFromLead);

  // Re-apply anchor offset on initial hash load. Deferred scripts run after the
  // browser's first hash-jump, and content-heavy pages keep growing as images
  // load — so re-scroll after full load (plus a short retry) to land cleanly.
  if (location.hash && location.hash.length > 1){
    const scrollToHash = () => {
      try { const t = document.querySelector(location.hash); if (t) t.scrollIntoView({ behavior:'auto', block:'start' }); } catch(e){}
    };
    const run = () => setTimeout(scrollToHash, 160);
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
  }

  /* ============================ STYLES ============================ */
  const css = `
  .am-fab{
    position:fixed; right:28px; bottom:28px; z-index:9000;
    display:inline-flex; align-items:center; gap:11px;
    padding:13px 20px 13px 13px; border-radius:999px; cursor:pointer; border:0;
    background:rgba(31,58,46,0.92);
    backdrop-filter:blur(18px) saturate(160%); -webkit-backdrop-filter:blur(18px) saturate(160%);
    border:1px solid rgba(245,241,232,0.22);
    box-shadow:0 12px 38px rgba(0,0,0,0.28), inset 0 1px 0 rgba(245,241,232,0.14);
    color:#F5F1E8; font-family:'Inter','Helvetica Neue',sans-serif;
    font-size:13px; font-weight:500; letter-spacing:0.04em;
    transition:transform 0.22s ease, box-shadow 0.22s ease, opacity 0.2s;
  }
  .am-fab:hover{ transform:translateY(-2px); box-shadow:0 16px 44px rgba(0,0,0,0.34) }
  .am-fab.is-hidden{ opacity:0; pointer-events:none; transform:scale(0.9) }
  .am-fab__avatar{
    width:34px; height:34px; border-radius:50%;
    background:#F5F1E8; border:1px solid #A88746;
    flex:none; position:relative; overflow:visible;
  }
  .am-fab__avatar-img{
    position:absolute; inset:0; border-radius:50%; overflow:hidden;
    display:flex; align-items:center; justify-content:center;
  }
  .am-fab__avatar img{ width:160%; height:160%; object-fit:contain }
  .am-fab__status{
    position:absolute; right:-2px; bottom:-2px; width:11px; height:11px; border-radius:50%;
    background:#7BB68B; border:2px solid #1F3A2E; z-index:2;
  }
  .am-fab__label strong{ display:block; font-size:13px; font-weight:600; line-height:1.1 }
  .am-fab__label span{ display:block; font-size:11px; opacity:0.72; margin-top:2px; letter-spacing:0.05em }
  .am-fab__badge{
    position:absolute; top:-6px; right:-6px; min-width:18px; height:18px; padding:0 5px;
    border-radius:999px; background:#7A1E1E; color:#F5F1E8; font-size:11px; font-weight:700;
    display:none; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.3);
  }
  .am-fab__badge.is-shown{ display:inline-flex }

  .am-nudge{
    position:fixed; right:28px; bottom:96px; z-index:8999; max-width:260px;
    background:#fff; color:#1A1A1A; border:1px solid rgba(31,58,46,0.12);
    border-radius:14px; border-bottom-right-radius:4px; padding:14px 16px;
    box-shadow:0 16px 44px rgba(0,0,0,0.2); font-family:'Inter',sans-serif; font-size:14px;
    line-height:1.45; opacity:0; transform:translateY(10px) scale(0.96); pointer-events:none;
    transition:all 0.3s cubic-bezier(0.2,0.8,0.2,1);
  }
  .am-nudge.is-shown{ opacity:1; transform:translateY(0) scale(1); pointer-events:auto; cursor:pointer }
  .am-nudge strong{ color:#1F3A2E }
  .am-nudge__x{ position:absolute; top:6px; right:8px; border:0; background:none; color:#5C5C5C; font-size:16px; cursor:pointer; line-height:1; padding:2px }

  .am-panel{
    position:fixed; right:28px; bottom:96px; z-index:9001;
    width:min(390px, calc(100vw - 32px));
    height:min(600px, calc(100vh - 130px));
    display:flex; flex-direction:column;
    background:rgba(245,241,232,0.94);
    backdrop-filter:blur(26px) saturate(180%); -webkit-backdrop-filter:blur(26px) saturate(180%);
    border:1px solid rgba(31,58,46,0.16);
    border-radius:18px; overflow:hidden;
    box-shadow:0 28px 70px rgba(0,0,0,0.3);
    font-family:'Inter','Helvetica Neue',sans-serif;
    transform:translateY(20px) scale(0.96); opacity:0; pointer-events:none;
    transition:transform 0.3s cubic-bezier(0.2,0.85,0.25,1), opacity 0.22s ease;
  }
  .am-panel.is-open{ transform:translateY(0) scale(1); opacity:1; pointer-events:auto }
  .am-panel__head{
    background:#1F3A2E; color:#F5F1E8; padding:16px 18px;
    display:flex; align-items:center; gap:12px; position:relative;
  }
  .am-panel__head::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:1px; background:linear-gradient(90deg, transparent, rgba(168,135,70,0.6), transparent) }
  .am-panel__avatar{
    width:40px; height:40px; border-radius:50%;
    background:#F5F1E8; border:1px solid #A88746;
    flex:none; position:relative; overflow:visible;
  }
  .am-panel__avatar img{ width:160%; height:160%; object-fit:contain }
  .am-panel__avatar .am-fab__status{ width:11px; height:11px; border:2px solid #1F3A2E; right:-2px; bottom:-2px }
  .am-panel__title strong{ display:block; font-family:'Cormorant Garamond',Georgia,serif; font-size:21px; font-weight:600; line-height:1 }
  .am-panel__title span{ display:flex; align-items:center; gap:6px; font-size:11px; opacity:0.78; letter-spacing:0.1em; text-transform:uppercase; margin-top:3px }
  .am-panel__title span::before{ content:""; width:6px; height:6px; border-radius:50%; background:#7BB68B; box-shadow:0 0 6px #7BB68B }
  .am-panel__actions{ margin-left:auto; display:flex; gap:2px }
  .am-panel__btn{
    background:transparent; border:0; color:#F5F1E8; cursor:pointer;
    font-size:18px; line-height:1; padding:6px 8px; opacity:0.65; border-radius:6px; transition:all 0.18s;
  }
  .am-panel__btn:hover{ opacity:1; background:rgba(245,241,232,0.1) }
  .am-msgs{
    flex:1; overflow-y:auto; padding:18px 16px 8px;
    display:flex; flex-direction:column; gap:4px;
    scrollbar-width:thin; scrollbar-color:#A88746 transparent;
  }
  .am-msgs::-webkit-scrollbar{ width:6px }
  .am-msgs::-webkit-scrollbar-thumb{ background:#A88746; border-radius:3px }
  .am-row{ display:flex; flex-direction:column; margin-bottom:8px }
  .am-row--user{ align-items:flex-end }
  .am-row--bot{ align-items:flex-start }
  .am-msg{
    max-width:88%; padding:11px 14px; border-radius:15px;
    font-size:14px; line-height:1.5; word-wrap:break-word;
    animation:am-msg-in 0.32s cubic-bezier(0.2,0.8,0.2,1);
  }
  @keyframes am-msg-in{ from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }
  .am-msg--bot{ background:#fff; color:#1A1A1A; border:1px solid rgba(31,58,46,0.1); border-bottom-left-radius:4px }
  .am-msg--user{ background:#1F3A2E; color:#F5F1E8; border-bottom-right-radius:4px }
  .am-msg a{ color:#7A1E1E; border-bottom:1px solid #A88746; text-decoration:none; font-weight:500 }
  .am-msg--user a{ color:#A88746; border-bottom-color:rgba(245,241,232,0.4) }
  .am-msg strong{ font-weight:600 }
  .am-msg code{ background:rgba(31,58,46,0.08); padding:1px 6px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:13px; color:#1F3A2E }
  .am-msg--user code{ background:rgba(245,241,232,0.16); color:#F5F1E8 }
  .am-cta-link{ display:block; margin-top:10px; text-align:center; background:#7A1E1E; color:#F5F1E8 !important; border:0 !important; border-radius:999px; padding:12px 18px; font-weight:600 !important; font-size:13px; letter-spacing:0.04em; text-decoration:none; transition:background 0.18s }
  .am-cta-link:hover{ background:#5A1414 }
  .am-cta-link--ghost{ background:transparent; color:#7A1E1E !important; border:1px solid rgba(122,30,30,0.4) !important; margin-top:8px }
  .am-cta-link--ghost:hover{ background:rgba(122,30,30,0.08) }
  .am-time{ font-size:10px; color:#5C5C5C; opacity:0.6; margin:3px 4px 0; letter-spacing:0.04em }
  .am-typing{ display:inline-flex; gap:4px; padding:6px 2px }
  .am-typing span{ width:6px; height:6px; border-radius:50%; background:#5C5C5C; opacity:0.4; animation:am-bounce 1.4s infinite }
  .am-typing span:nth-child(2){ animation-delay:0.18s } .am-typing span:nth-child(3){ animation-delay:0.36s }
  @keyframes am-bounce{ 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }

  .am-quick{ padding:4px 14px 12px; display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid rgba(31,58,46,0.08) }
  .am-quick button{
    background:transparent; border:1px solid rgba(31,58,46,0.2); color:#1F3A2E;
    padding:8px 13px; border-radius:999px; cursor:pointer;
    font-family:'Inter',sans-serif; font-size:11.5px; letter-spacing:0.04em; transition:all 0.18s;
  }
  .am-quick button:hover{ background:#1F3A2E; color:#F5F1E8; border-color:#1F3A2E }
  .am-quick button.am-quick--cta{ background:rgba(122,30,30,0.08); border-color:rgba(122,30,30,0.4); color:#7A1E1E; font-weight:600 }
  .am-quick button.am-quick--cta:hover{ background:#7A1E1E; color:#F5F1E8; border-color:#7A1E1E }

  .am-input{ display:flex; gap:8px; padding:13px 14px; border-top:1px solid rgba(31,58,46,0.08); background:rgba(245,241,232,0.6) }
  .am-input input{
    flex:1; background:#fff; border:1px solid rgba(31,58,46,0.16); border-radius:999px;
    padding:11px 16px; outline:none; font-family:inherit; font-size:14px; color:#1A1A1A; transition:border-color 0.18s;
  }
  .am-input input:focus{ border-color:#1F3A2E }
  .am-input button{
    background:#7A1E1E; color:#F5F1E8; border:0; width:42px; height:42px; border-radius:50%;
    cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background 0.18s; flex:none;
  }
  .am-input button:hover{ background:#5A1414 }
  .am-input button svg{ width:18px; height:18px }
  .am-foot{ text-align:center; padding:7px 14px 10px; font-size:10px; color:#5C5C5C; letter-spacing:0.06em }
  .am-foot strong{ color:#1F3A2E; font-weight:600 }

  @media (max-width:520px){
    .am-fab{ right:16px; bottom:16px; padding:11px 16px 11px 11px }
    .am-fab__label{ display:none }
    .am-nudge{ right:16px; bottom:80px; max-width:220px }
    .am-panel{ right:16px; left:16px; bottom:80px; width:auto; height:calc(100vh - 104px) }
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ============================ DOM ============================ */
  const fab = document.createElement('button');
  fab.className = 'am-fab';
  fab.setAttribute('aria-label','Open Ask Mercatorum');
  fab.innerHTML = `
    <span class="am-fab__avatar"><span class="am-fab__avatar-img"><img src="https://cdn.jsdelivr.net/gh/yungmoneyhuncho/mercatorum-assets@main/logo-monogram.png" alt=""></span><span class="am-fab__status"></span></span>
    <span class="am-fab__label"><strong>Ask Mercatorum</strong><span>Online · trade help</span></span>
    <span class="am-fab__badge" id="am-badge">1</span>`;

  const nudge = document.createElement('div');
  nudge.className = 'am-nudge';
  nudge.innerHTML = `<button class="am-nudge__x" aria-label="Dismiss">×</button>
    <strong>Looking for a quote?</strong> Ask me about any commodity, Incoterm, or conversion — or I'll route you to the desk.`;

  const panel = document.createElement('div');
  panel.className = 'am-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Ask Mercatorum chat');
  panel.innerHTML = `
    <div class="am-panel__head">
      <span class="am-panel__avatar"><span class="am-fab__avatar-img"><img src="https://cdn.jsdelivr.net/gh/yungmoneyhuncho/mercatorum-assets@main/logo-monogram.png" alt=""></span><span class="am-fab__status"></span></span>
      <div class="am-panel__title"><strong>Ask Mercatorum</strong><span>Canadian trading desk</span></div>
      <div class="am-panel__actions">
        <button class="am-panel__btn" id="am-reset" aria-label="Start over" title="Start over">⟲</button>
        <button class="am-panel__btn" id="am-close" aria-label="Close">×</button>
      </div>
    </div>
    <div class="am-msgs" id="am-msgs"></div>
    <div class="am-quick" id="am-quick"></div>
    <form class="am-input" id="am-form">
      <input type="text" id="am-q" placeholder="Ask about a commodity, term, or quote…" autocomplete="off" />
      <button type="submit" aria-label="Send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </form>
    <div class="am-foot">Pre-sales assistant · not legal or trading advice</div>`;

  document.body.appendChild(fab);
  document.body.appendChild(nudge);
  document.body.appendChild(panel);

  const msgs  = panel.querySelector('#am-msgs');
  const quick = panel.querySelector('#am-quick');
  const form  = panel.querySelector('#am-form');
  const input = panel.querySelector('#am-q');
  const badge = fab.querySelector('#am-badge');

  /* ============================ STATE ============================ */
  const SS_KEY = 'mercatorum_chat_v2';
  const state = {
    history: [],          // [{who, html, t}]
    lastCommodity: null,  // remembered commodity context
    awaitingEmail: false, // simple lead-capture mode
    booking: null,        // guided booking flow: { step, data:{} }
    greeted: false
  };
  function save(){
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({history: state.history, lastCommodity: state.lastCommodity, booking: state.booking, greeted: state.greeted})); } catch(e){}
  }
  function load(){
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      state.history = d.history || [];
      state.lastCommodity = d.lastCommodity || null;
      state.booking = d.booking || null;
      state.greeted = !!d.greeted;
      return state.history.length > 0;
    } catch(e){ return false; }
  }

  /* ============================ OPEN / CLOSE ============================ */
  let opened = false;
  function openPanel(){
    panel.classList.add('is-open');
    fab.classList.add('is-hidden');
    nudge.classList.remove('is-shown');
    badge.classList.remove('is-shown');
    opened = true;
    if (state.history.length === 0 && !state.greeted){ greet(); }
    setTimeout(()=> input.focus(), 300);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function closePanel(){
    panel.classList.remove('is-open');
    fab.classList.remove('is-hidden');
    opened = false;
  }
  fab.addEventListener('click', openPanel);
  panel.querySelector('#am-close').addEventListener('click', closePanel);
  nudge.querySelector('.am-nudge__x').addEventListener('click', (e)=>{ e.stopPropagation(); nudge.classList.remove('is-shown'); sessionStorage.setItem('mercatorum_nudge_dismissed','1'); });
  nudge.addEventListener('click', openPanel);
  panel.querySelector('#am-reset').addEventListener('click', ()=>{
    state.history = []; state.lastCommodity = null; state.awaitingEmail = false; state.booking = null; state.greeted = false;
    msgs.innerHTML = ''; save(); greet();
  });

  /* ============================ RENDER ============================ */
  function nowStr(){ const d = new Date(); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function pushMsg(who, html, t, persist){
    const row = document.createElement('div');
    row.className = 'am-row am-row--' + who;
    const m = document.createElement('div');
    m.className = 'am-msg am-msg--' + who;
    m.innerHTML = html;
    row.appendChild(m);
    const time = document.createElement('div');
    time.className = 'am-time';
    time.textContent = t || nowStr();
    row.appendChild(time);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    if (persist !== false){ state.history.push({who, html, t: t || nowStr()}); save(); }
  }
  function addTyping(){
    const row = document.createElement('div');
    row.className = 'am-row am-row--bot'; row.id = 'am-typing-row';
    row.innerHTML = '<div class="am-msg am-msg--bot"><span class="am-typing"><span></span><span></span><span></span></span></div>';
    msgs.appendChild(row); msgs.scrollTop = msgs.scrollHeight;
  }
  function removeTyping(){ const t = document.getElementById('am-typing-row'); if (t) t.remove(); }
  function setQuick(items){
    quick.innerHTML = '';
    (items || []).forEach(it => {
      const label = typeof it === 'string' ? it : it.label;
      const cta   = typeof it === 'object' && it.cta;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      if (cta) b.className = 'am-quick--cta';
      b.addEventListener('click', ()=>{ submit(label); });
      quick.appendChild(b);
    });
  }

  /* ============================ FLOW ============================ */
  function greet(){
    state.greeted = true;
    pushMsg('bot', `Hi — I'm the Mercatorum desk assistant. I can help you:<br><br>
      • Understand what we trade &amp; how a deal works<br>
      • Navigate Incoterms, payment &amp; documents<br>
      • Convert units — try <code>500 MT canola to bushels</code><br>
      • <strong>Build an inquiry</strong> and hand it to a trader, pre-filled<br><br>
      What are you working on?`);
    setQuick([{ label:'Book an inquiry', cta:true }, 'What do you trade?', 'How does a trade work?', 'CFR vs CIF?']);
  }

  function botRespond(userText){
    addTyping();
    const useRemote = !!window.MERCATORUM_CHAT_ENDPOINT;
    const finish = (replyObj) => {
      removeTyping();
      pushMsg('bot', replyObj.html);
      setQuick(replyObj.chips || defaultChips());
    };
    if (useRemote){
      fetch(window.MERCATORUM_CHAT_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: state.history.map(h=>({role:h.who==='user'?'user':'assistant', content:h.html})) })
      })
      .then(r => r.json())
      .then(d => setTimeout(()=> finish({ html: d.reply || brain(userText).html, chips: brain(userText).chips }), 350))
      .catch(()=> setTimeout(()=> finish(brain(userText)), 350));
    } else {
      const out = brain(userText);
      setTimeout(()=> finish(out), 480 + Math.min(800, (out.html||'').length * 5));
    }
  }

  function submit(text){
    const q = (text || input.value).trim();
    if (!q) return;
    pushMsg('user', escapeHtml(q));
    input.value = '';
    botRespond(q);
  }
  form.addEventListener('submit', e=>{ e.preventDefault(); submit(); });

  function escapeHtml(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function defaultChips(){
    const base = ['What do you trade?', 'Incoterms', { label:'Get a quote', cta:true }];
    if (state.lastCommodity) base.unshift('Quote ' + state.lastCommodity);
    return base;
  }

  /* ============================ BRAIN ============================ */
  const BUSHEL_KG = { wheat:27.2155, canola:22.6796, barley:21.7724, oats:14.5150, corn:25.4012, soybeans:27.2155, soy:27.2155, flax:25.4012, peas:27.2155, lentils:27.2155 };
  const OIL_BBL_PER_MT = 7.33;
  const COMMODITIES = ['wheat','durum','barley','oats','canola','flax','soybean','soybeans','soy','peas','pea','lentil','lentils','chickpea','chickpeas','crude','oil','diesel','gasoline','jet','ngl','urea','dap','potash','mop','methanol','polypropylene','fertilizer'];

  function detectCommodity(q){
    for (const c of COMMODITIES){ if (q.includes(c)) return c; }
    return null;
  }
  function canonicalGrain(c){
    if (!c) return null;
    if (c.startsWith('soy')) return 'soybeans';
    if (c.startsWith('pea')) return 'peas';
    if (c.startsWith('lentil')) return 'lentils';
    if (BUSHEL_KG[c]) return c;
    return null;
  }

  // unit normalization
  function normUnit(u){
    u = u.toLowerCase();
    if (/^(mt|tonne|tonnes|ton|tons|metric)/.test(u)) return 'mt';
    if (/^(bu|bushel|bushels)/.test(u)) return 'bu';
    if (/^(bbl|barrel|barrels)/.test(u)) return 'bbl';
    if (/^(kg|kilo|kilos|kilogram|kilograms)/.test(u)) return 'kg';
    if (/^(lb|lbs|pound|pounds)/.test(u)) return 'lb';
    if (/^(gal|gallon|gallons)/.test(u)) return 'gal';
    return null;
  }
  function tryConvert(q){
    // find a number
    const numMatch = q.match(/([\d,]+(?:\.\d+)?)/);
    if (!numMatch) return null;
    const value = parseFloat(numMatch[1].replace(/,/g,''));
    if (!isFinite(value)) return null;
    // find up to two unit words
    const unitWords = q.match(/\b(mt|tonnes?|tons?|metric tons?|bu|bushels?|bbl|barrels?|kg|kilograms?|lbs?|pounds?|gal|gallons?)\b/gi) || [];
    if (unitWords.length < 1) return null;
    const fromU = normUnit(unitWords[0]);
    let toU = unitWords[1] ? normUnit(unitWords[1]) : null;
    // if only one unit, infer the "to" from "to X" or default
    if (!toU){
      if (/bushel|\bbu\b/.test(q)) toU = 'bu';
      else if (/tonne|\bmt\b|metric/.test(q)) toU = 'mt';
      else if (/barrel|\bbbl\b/.test(q)) toU = 'bbl';
      else toU = (fromU === 'mt') ? 'bu' : 'mt';
    }
    if (!fromU || !toU || fromU === toU) return null;
    const commodityRaw = detectCommodity(q);
    const grain = canonicalGrain(commodityRaw);
    const isOil = commodityRaw && /crude|oil|diesel|gasoline|jet|ngl/.test(commodityRaw);

    // convert to kg first
    function toKg(v,u){
      if (u==='mt') return v*1000;
      if (u==='kg') return v;
      if (u==='lb') return v*0.453592;
      if (u==='bu'){ if(!grain) return null; return v*BUSHEL_KG[grain]; }
      if (u==='bbl'){ return (v/OIL_BBL_PER_MT)*1000; }
      if (u==='gal'){ return ((v/42)/OIL_BBL_PER_MT)*1000; }
    }
    function fromKg(kg,u){
      if (u==='mt') return kg/1000;
      if (u==='kg') return kg;
      if (u==='lb') return kg/0.453592;
      if (u==='bu'){ if(!grain) return null; return kg/BUSHEL_KG[grain]; }
      if (u==='bbl'){ return (kg/1000)*OIL_BBL_PER_MT; }
      if (u==='gal'){ return ((kg/1000)*OIL_BBL_PER_MT)*42; }
    }
    if (((fromU==='bu'||toU==='bu')) && !grain){
      return { needGrain:true };
    }
    const kg = toKg(value, fromU);
    if (kg == null) return null;
    const result = fromKg(kg, toU);
    if (result == null) return null;
    const fmt = n => n>=1000 ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n.toLocaleString(undefined,{maximumFractionDigits:3});
    const uname = { mt:'MT', bu:'bushels', bbl:'bbl', kg:'kg', lb:'lb', gal:'US gal' };
    let note = '';
    if (grain) { state.lastCommodity = grain; note = ` <span style="opacity:0.7">(${grain}, ${BUSHEL_KG[grain]} kg/bu)</span>`; }
    if (isOil) note = ` <span style="opacity:0.7">(crude, ${OIL_BBL_PER_MT} bbl/MT — varies with API)</span>`;
    return { html: `<code>${fmt(value)} ${uname[fromU]}</code> ≈ <code>${fmt(result)} ${uname[toU]}</code>${note}<br><br>Full converter with every grain: <a href="/knowledge#converter">Knowledge Center →</a>. Want a price on this volume? I can route you to the desk.`,
             chips: ['Get a quote', 'Another conversion', state.lastCommodity ? ('About ' + grain) : 'What do you trade?'] };
  }

  const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

  /* ===================== ENTITY EXTRACTION ===================== */
  const INCOTERMS_ALL = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'];
  function extractIncoterm(q){
    const m = q.toUpperCase().match(/\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/);
    return m ? m[1] : null;
  }
  function extractVolume(q){
    const m = q.replace(/,/g,'').match(/\b(\d{2,9})\s*(mt|t|tonnes?|tons?|kg|bbl|barrels?|fcl|teu|containers?)?\b/i);
    if (!m) return null;
    const n = Number(m[1]); if (!isFinite(n) || n < 1) return null;
    let unit = (m[2] || 'MT').toUpperCase();
    if (/^T$|^TONNE|^TON/.test(unit)) unit = 'MT';
    if (/^CONTAINER|^FCL|^TEU/.test(unit)) unit = (m[2]||'').toUpperCase();
    return n.toLocaleString() + ' ' + unit;
  }
  const COUNTRY_HINTS = ['india','china','uae','dubai','jebel ali','mundra','nhava','japan','korea','vietnam','indonesia','singapore','malaysia','bangladesh','pakistan','turkey','turkiye','egypt','morocco','algeria','nigeria','kenya','south africa','brazil','mexico','peru','colombia','chile','netherlands','rotterdam','germany','italy','spain','belgium','usa','united states','houston','saudi','qatar','oman','iraq','sri lanka','philippines','thailand','taiwan'];
  function extractDestination(q){
    const lq = q.toLowerCase();
    for (const c of COUNTRY_HINTS){ if (lq.includes(c)) return c.replace(/\b\w/g, m=>m.toUpperCase()); }
    const m = q.match(/\bto\s+([A-Z][a-zA-Z]+(?:[ ,]+[A-Z][a-zA-Z]+){0,2})/);
    return m ? m[1].trim() : null;
  }

  /* ===================== GUIDED BOOKING FLOW ===================== */
  const BOOK_STEPS = ['side','commodity','volume','destination','incoterm','name','email'];
  const BOOK_PROMPT = {
    side:        () => ({ html:`Let's package this up for the desk — takes about a minute and a trader gets it pre-filled.<br><br>First: are you <strong>buying</strong> or <strong>selling</strong>?`, chips:['Buying','Selling','Skip'] }),
    commodity:   () => ({ html:`Which <strong>commodity</strong>? Add a grade if you know it — e.g. <em>Canola No.1 CAN</em>, <em>Red lentils</em>, <em>WCS crude</em>.`, chips:['Canola','Red lentils','Wheat','Urea'] }),
    volume:      () => ({ html:`<strong>Volume per shipment?</strong> e.g. <em>25,000 MT</em>, or <em>2 × FCL</em> for containers.`, chips:['25,000 MT','12,500 MT','1 FCL','Skip'] }),
    destination: () => ({ html:`<strong>Destination</strong> — port or country? e.g. <em>Jebel Ali, UAE</em> or <em>Mundra, India</em>.`, chips:['Skip'] }),
    incoterm:    () => ({ html:`Preferred <strong>Incoterm?</strong> (Not sure is fine — the trader will advise.)`, chips:['FOB','CFR','CIF','DAP','Not sure'] }),
    name:        () => ({ html:`Who should the trader address the offer to — your <strong>name?</strong>`, chips:['Skip'] }),
    email:       () => ({ html:`Last one — your <strong>business email</strong> so the trader can send the offer. (Used only for this inquiry.)`, chips:['Skip'] })
  };
  const BOOK_LABEL = { side:'Side', commodity:'Commodity', volume:'Volume', destination:'Destination', incoterm:'Incoterm', name:'Name', email:'Email' };

  function startBooking(seed){
    state.booking = { step:0, data:{} };
    if (seed){
      if (seed.commodity)   state.booking.data.commodity = seed.commodity;
      if (seed.volume)      state.booking.data.volume = seed.volume;
      if (seed.destination) state.booking.data.destination = seed.destination;
      if (seed.incoterm)    state.booking.data.incoterm = seed.incoterm;
      if (seed.side)        state.booking.data.side = seed.side;
    }
    return advanceBooking(true);
  }
  function advanceBooking(first){
    const b = state.booking;
    // skip any steps already seeded
    while (b.step < BOOK_STEPS.length && b.data[BOOK_STEPS[b.step]]) b.step++;
    if (b.step >= BOOK_STEPS.length) return finishBooking();
    const key = BOOK_STEPS[b.step];
    const p = BOOK_PROMPT[key]();
    if (first && (b.data.commodity || b.data.volume || b.data.destination)){
      const got = Object.keys(b.data).filter(k=>b.data[k]).map(k=>BOOK_LABEL[k]+': <strong>'+escapeHtml(String(b.data[k]))+'</strong>').join(' · ');
      p.html = `Got it so far — ${got}.<br><br>` + p.html;
    }
    return p;
  }
  function handleBooking(qRaw){
    const b = state.booking;
    const val = qRaw.trim();
    const low = val.toLowerCase();
    if (/^(cancel|stop|never ?mind|quit|exit|forget it)$/.test(low)){
      state.booking = null;
      return { html:`No problem — cancelled. Ask me anything, or start again whenever.`, chips:[{label:'Book an inquiry',cta:true},'What do you trade?'] };
    }
    const key = BOOK_STEPS[b.step];
    const skip = /^(skip|next|n\/a|na|none|not sure|dunno|don'?t know)$/.test(low);

    if (key === 'email' && !skip){
      const m = val.match(EMAIL_RE);
      if (!m) return { html:`That doesn't look like an email — mind re-typing it? Or say <em>skip</em> and the trader will use the rest.`, chips:['Skip'] };
      b.data.email = m[0];
    } else if (!skip){
      if (key === 'side')      b.data.side = /sell/.test(low) ? 'Selling' : (/buy/.test(low) ? 'Buying' : val);
      else if (key === 'incoterm') b.data.incoterm = extractIncoterm(val) || (skip?'':val);
      else if (key === 'commodity'){ b.data.commodity = val; const c = detectCommodity(low); if (c) state.lastCommodity = canonicalGrain(c) || c; }
      else b.data[key] = val;
    }
    b.step++;
    return advanceBooking(false);
  }
  function finishBooking(){
    const d = state.booking.data;
    state.booking = null;
    // persist for the LOI form to pick up
    try { localStorage.setItem('mercatorum_lead', JSON.stringify(d)); } catch(e){}
    const rows = [];
    if (d.side)        rows.push(['Side', d.side]);
    if (d.commodity)   rows.push(['Commodity', d.commodity]);
    if (d.volume)      rows.push(['Volume', d.volume]);
    if (d.destination) rows.push(['Destination', d.destination]);
    if (d.incoterm)    rows.push(['Incoterm', d.incoterm]);
    if (d.name)        rows.push(['Contact', d.name]);
    if (d.email)       rows.push(['Email', d.email]);
    const summary = rows.map(r=>`<strong>${r[0]}:</strong> ${escapeHtml(String(r[1]))}`).join('<br>');
    // build a mailto with everything
    const subj = encodeURIComponent('Trade inquiry' + (d.commodity ? ' — '+d.commodity : ''));
    const body = encodeURIComponent(
      'Inquiry from mercatorum.ca chat:\n\n' +
      rows.map(r=>r[0]+': '+r[1]).join('\n') +
      '\n\n(Please send a firm offer and draft contract.)'
    );
    const mailto = `mailto:sales@mercatorum.ca?subject=${subj}&body=${body}`;
    return {
      html: `Here's your inquiry:<br><br>${summary || '<em>(no details captured)</em>'}<br><br>` +
            `I've saved this so the LOI form opens <strong>pre-filled</strong> — just review and submit, and it routes straight to the senior trader for your product line.<br><br>` +
            `<a class="am-cta-link" href="/contact#loi">Open my pre-filled LOI form →</a>` +
            `<a class="am-cta-link am-cta-link--ghost" href="${mailto}">Or email the desk now</a>`,
      chips: ['Edit / start over', 'What happens next?', 'Payment terms?']
    };
  }

  function brain(qRaw){
    const q = qRaw.toLowerCase().trim();
    const has = (...w) => w.some(x => q.includes(x));

    // 0) ACTIVE BOOKING FLOW takes priority
    if (state.booking){ return handleBooking(qRaw); }

    // 0b) start / restart booking
    if (has('book an inquiry','book inquiry','start over','edit /','build an inquiry','start an inquiry','start inquiry','open an inquiry')){
      const seed = {};
      const c = detectCommodity(q); if (c) seed.commodity = canonicalGrain(c) || c;
      const v = extractVolume(q); if (v) seed.volume = v;
      const dst = extractDestination(qRaw); if (dst) seed.destination = dst;
      const inc = extractIncoterm(q); if (inc) seed.incoterm = inc;
      if (/\bsell/.test(q)) seed.side = 'Selling'; else if (/\bbuy/.test(q)) seed.side = 'Buying';
      return startBooking(seed);
    }
    // 0c) "what happens next" after a booking
    if (has('what happens next','what next','then what','after i submit','after submit'))
      return { html:`Once your LOI lands: <br><br>1. The senior trader for that product confirms receipt (same day).<br>2. We run a quick KYC + check supply and freight.<br>3. You get a <strong>firm offer</strong> with price, terms &amp; validity — usually 1–2 business days.<br>4. Agree terms → we issue a draft contract → you open the LC → we ship.<br><br>Ready? <a href="/contact#loi">Open the LOI form →</a>`, chips:[{label:'Book an inquiry',cta:true},'Payment terms?','Documents needed'] };

    // 1) lead-capture: awaiting an email
    if (state.awaitingEmail){
      const m = qRaw.match(EMAIL_RE);
      if (m){
        state.awaitingEmail = false;
        return { html: `Got it — <strong>${escapeHtml(m[0])}</strong>. I've flagged this for the desk${state.lastCommodity ? ' (re: '+state.lastCommodity+')' : ''} and a trader will reach out within one business day.<br><br>For a firm price &amp; terms faster, the <a href="/contact#loi">LOI form</a> goes straight to the senior trader.`,
                 chips: [{ label:'Submit an LOI', cta:true }, 'What do you trade?', 'Incoterms'] };
      }
      if (has('no','later','not now','nvm','cancel')){
        state.awaitingEmail = false;
        return { html:`No problem. Ask me anything else, or submit an <a href="/contact#loi">LOI</a> whenever you're ready.`, chips: defaultChips() };
      }
      return { html:`Just drop a business email and I'll have a trader follow up — or say "no" to skip.`, chips:['No thanks'] };
    }

    // 2) email volunteered mid-conversation
    const emailVolunteered = qRaw.match(EMAIL_RE);
    if (emailVolunteered){
      return { html:`Thanks — I've noted <strong>${escapeHtml(emailVolunteered[0])}</strong> for the desk${state.lastCommodity ? ' (re: '+state.lastCommodity+')' : ''}. A trader will be in touch within one business day. For a firm offer, the <a href="/contact#loi">LOI form</a> is fastest.`,
               chips:[{ label:'Submit an LOI', cta:true }, 'What do you trade?'] };
    }

    // 3) live conversion
    if (has('convert','conversion') || (/\d/.test(q) && /bushel|tonne|\bmt\b|barrel|\bbbl\b|\bbu\b|gallon|\bkg\b|\blb\b|pound/.test(q))){
      const conv = tryConvert(q);
      if (conv && conv.needGrain){
        return { html:`Bushel weight depends on the crop. Which one — wheat, canola, barley, oats, corn, or soybeans? (e.g. <code>1000 MT canola to bushels</code>)`, chips:['Wheat','Canola','Barley','Oats'] };
      }
      if (conv) return conv;
    }

    // 4) greetings
    if (/^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening))\b/.test(q))
      return { html:`Hello — glad to help. Are you buying, selling, or just scoping the market? And which commodity?`, chips:['I want to buy','What do you trade?','Just looking'] };

    // 4a) simple "what can you do / help" (keep it plain)
    if (/^(help|menu|options)\b/.test(q) || has('what can you do','what can you help','what do you do here','how do you work','how does this work','what is this'))
      return { html:`I'm the Mercatorum desk assistant — happy to keep it simple. I can:<br><br>• Tell you <strong>what we sell</strong><br>• Explain <strong>how to buy</strong> and what an LOI is<br>• Break down <strong>shipping terms</strong> (FOB, CIF…) and <strong>payment</strong><br>• Do quick <strong>unit conversions</strong> (tonnes ↔ bushels, barrels…)<br>• <strong>Connect you to a real trader</strong><br><br>What would you like?`, chips:['What do you sell?','How do I buy?','Get a price','Talk to a human'] };

    // 4b) talk to a human
    if (has('human','real person','speak to someone','talk to someone','representative','salesperson','call me','speak to a trader','live person','real trader','speak to a human'))
      return { html:`Of course. A real trader replies within one business day at <a href="mailto:sales@mercatorum.ca">sales@mercatorum.ca</a>. The fastest route to a firm price is the <a href="/contact#loi">LOI form</a> — it lands straight with a senior trader. Want me to take a few details now instead?`, chips:[{label:'Book an inquiry',cta:true},'Submit an LOI','What do you sell?'] };

    // 4c) simple "how do I buy"
    if (has('how do i buy','how to buy','how can i buy','how do i order','how to order','how do i purchase','how do i get one','how do i get started buying'))
      return { html:`Simple version — tell us what you want and we send a firm offer:<br><br><strong>1.</strong> Send an <a href="/contact#loi">LOI</a> (what, how much, where, how you'll pay).<br><strong>2.</strong> We reply with a price &amp; terms.<br><strong>3.</strong> You open the LC, we ship, you pay against documents.<br><br>Want me to start one now?`, chips:[{label:'Book an inquiry',cta:true},'What do you sell?','Payment terms?'] };

    // 5) buying / selling intent → start guided booking
    if (has('want to buy','looking to buy','need to buy','interested in buying','i want to buy','place an order','procure','sourcing','source ','purchase','buy ','buyer','import','want to sell','looking to sell','i sell','i supply','i am a producer','we produce','offer to sell','i\'m selling','seller','export ')){
      const seed = {};
      const c = detectCommodity(q); if (c){ seed.commodity = canonicalGrain(c) || c; state.lastCommodity = seed.commodity; }
      const v = extractVolume(q); if (v) seed.volume = v;
      const dst = extractDestination(qRaw); if (dst) seed.destination = dst;
      const inc = extractIncoterm(q); if (inc) seed.incoterm = inc;
      if (/\bsell|supply|produce|seller|export/.test(q)) seed.side = 'Selling'; else seed.side = 'Buying';
      return startBooking(seed);
    }

    // 6) "just looking" / info
    if (has('just looking','just browsing','just info','no, just info','exploring','scoping'))
      return { html:`All good — ask away. Popular topics: what we trade, Incoterms, document checklists, or a quick unit conversion. When you're ready for a price, the <a href="/contact#loi">LOI</a> routes to the desk.`, chips:['What do you trade?','CFR vs CIF?','Documents needed'] };

    // 7) products
    if (has('what','which') && has('trade','sell','offer','products','commodit','deal in')){
      return { html:`Three desks:<br><br><strong>Agriculture</strong> — wheat, durum, barley, oats, canola, flax, soybeans, peas, lentils, chickpeas.<br><strong>Energy</strong> — crude, condensate, propane/LPG, diesel, gasoline, jet, NGLs.<br><strong>Chemicals &amp; fertilizer</strong> — urea, DAP, MAP, potash (MOP), sulphur, methanol, caustic soda.<br><br>Full catalogue with photos: <a href="/products">products page</a>. Which one interests you?`,
               chips:['Canola','Lentils','LPG / propane','Fertilizer'] };
    }

    // 8) per-commodity
    const c = detectCommodity(q);
    if (c){
      state.lastCommodity = canonicalGrain(c) || c;
      if (/canola|rapeseed/.test(c)) return { html:`<strong>Canola</strong> — one of our biggest desks. Sourced from named SK/AB growers, shipped FOB Vancouver/Prince Rupert into Asia and CIF Rotterdam into the EU. Our latest read: <a href="/insights-canola-2026">canola outlook</a>. Want a quote?`, chips:[{label:'Quote canola',cta:true},'Convert canola MT→bu','Outlook'] };
      if (/lentil|pulse|chickpea|pea/.test(c)) return { html:`<strong>Pulses</strong> — red &amp; green lentils, yellow &amp; green peas, chickpeas, from SK/AB. Bulk into India/Bangladesh/Türkiye, containers everywhere else. See our <a href="/insights-lentils-2026">India-window note</a>.`, chips:[{label:'Quote pulses',cta:true},'Documents needed','Outlook'] };
      if (/wheat|durum|barley|oats|grain/.test(c)) return { html:`<strong>Grain</strong> — HRS &amp; durum wheat, barley, oats. Milling and feed grades, CFR or FOB out of Vancouver, Prince Rupert, or Thunder Bay. What volume and destination?`, chips:[{label:'Get a quote',cta:true},'Convert MT→bu','Incoterms'] };
      if (/crude|oil|diesel|gasoline|jet|ngl/.test(c)) return { html:`<strong>Energy</strong> — Canadian crude (WCS, MSW, Synthetic), diesel/ULSD, gasoline, jet, NGLs. From 25 kbbl up to vessel lots. Rail- or pipeline-connected origins.`, chips:[{label:'Get a quote',cta:true},'Convert bbl↔MT','Incoterms'] };
      if (/urea|dap|potash|mop|methanol|polypropylene|fertilizer/.test(c)) return { html:`<strong>Chemicals &amp; fertilizer</strong> — urea, DAP, MOP, methanol, polypropylene. Bulk or break-bulk by destination and volume. SDS and CoA on every cargo.`, chips:[{label:'Get a quote',cta:true},'Documents needed','Incoterms'] };
    }

    // 9) incoterms — comparisons first, then single terms
    if (has('cfr') && has('cif')) return { html:`<strong>CFR</strong> = Cost &amp; Freight — seller pays freight to the destination port; buyer carries voyage risk.<br><br><strong>CIF</strong> = CFR + marine insurance the seller buys for the voyage.<br><br>Full table: <a href="/knowledge#incoterms">Knowledge Center</a>.`, chips:['What is FOB?','What is DAP?','Get a quote'] };
    if (has('fob') && has('cif')) return { html:`<strong>FOB vs CIF:</strong><br><br>On <strong>FOB</strong> the seller just loads the vessel — you arrange and pay freight + insurance and carry the voyage risk. Lowest unit price, most control.<br><br>On <strong>CIF</strong> the seller pays freight <em>and</em> insurance to your port (risk still passes at loading). Simpler for you, priced higher.<br><br>Take FOB if you have freight; CIF if you'd rather we handle it.`, chips:['CFR vs CIF?','Which should I use?','Get a quote'] };
    if (has('fob') && has('cfr')) return { html:`<strong>FOB vs CFR:</strong> on FOB you book and pay the ocean freight; on CFR the seller books and pays freight to your port (you still carry the voyage risk, no insurance). CFR is handy when you'd rather not arrange shipping.`, chips:['CFR vs CIF?','Which should I use?'] };
    if (has('fob')) return { html:`<strong>FOB</strong> — Free On Board. Seller delivers onto the vessel at the load port; from there the buyer pays freight + insurance and carries the risk.`, chips:['CFR vs CIF?','What is FCA?','Get a quote'] };
    if (has('cif')) return { html:`<strong>CIF</strong> — Cost, Insurance &amp; Freight. Seller pays freight and buys marine insurance to the destination port; risk passes at the load port.`, chips:['CFR vs CIF?','What is FOB?'] };
    if (has('cfr')) return { html:`<strong>CFR</strong> — Cost &amp; Freight. Seller pays freight to the destination; buyer carries voyage risk (no insurance).`, chips:['CFR vs CIF?','What is FOB?'] };
    if (has('fca')) return { html:`<strong>FCA</strong> — Free Carrier. Seller delivers to a buyer-nominated carrier at the named place. Common for containers.`, chips:['What is FOB?','Get a quote'] };
    if (has('dap')) return { html:`<strong>DAP</strong> — Delivered At Place. Seller bears risk &amp; cost to the named delivery point; buyer handles import clearance &amp; duties.`, chips:['What is CIF?','Get a quote'] };
    if (has('incoterm','trade term')) return { html:`Incoterms 2020 — 11 rules for how cost &amp; risk pass. We mostly use FOB, CFR, CIF, FCA, DAP. Side-by-side breakdown: <a href="/knowledge#incoterms">Knowledge Center</a>.`, chips:['CFR vs CIF?','What is FOB?'] };

    // 10) documents
    if (has('document','paperwork','phyto','b/l','bill of lading','certificate','sgs','inspection'))
      return { html:`Standard export docs: commercial invoice, bill of lading, certificate of origin, phytosanitary (grain/pulses), weight &amp; quality from an independent surveyor, and insurance certificate on CIF. Per-commodity checklists: <a href="/knowledge#documents">Knowledge Center</a>.`, chips:['Payment terms?','Get a quote'] };

    // 11) LOI
    if (has('loi','letter of intent','what do i need'))
      return { html:`An <strong>LOI</strong> tells us the trade is real so we can issue a firm offer. You'll need: commodity &amp; grade, quantity per shipment, Incoterm, destination port, target price, payment instrument + issuing bank, and shipment window.<br><br>The <a href="/contact#loi">LOI form</a> walks you through it — about 6 minutes, routes to a senior trader.`, chips:[{label:'Submit an LOI',cta:true},'Minimum order?','Payment terms?'] };

    // 12) quote / contact → start guided booking
    if (has('quote','rfq','price','pricing','offer','how much','cost','get a quote','get started','book')){
      const seed = {};
      const c = detectCommodity(q); if (c) seed.commodity = canonicalGrain(c) || c;
      const v = extractVolume(q); if (v) seed.volume = v;
      const dst = extractDestination(qRaw); if (dst) seed.destination = dst;
      const inc = extractIncoterm(q); if (inc) seed.incoterm = inc;
      return startBooking(seed);
    }
    if (has('contact','email','phone','reach','talk to','speak'))
      return { html:`Reach the desk at <a href="mailto:sales@mercatorum.ca">sales@mercatorum.ca</a> or via the <a href="/contact">contact page</a>. Replies within one business day. Ready for a firm offer? The <a href="/contact#loi">LOI form</a> is fastest.`, chips:[{label:'Submit an LOI',cta:true},'What do you trade?'] };

    // 13) minimums, location, freight, insights, company
    if (has('minimum','min order','smallest','min volume','how small'))
      return { html:`Bulk: 25,000 MT and up per shipment. Containers: from one 20-ft FCL (~20–25 MT). Below that we'll point you to a regional aggregator.`, chips:[{label:'Get a quote',cta:true},'Incoterms'] };
    if (has('where','based','located','office','address','country'))
      return { html:`Mercatorum is a <strong>Canadian commodity merchant house</strong>; our trading desk sits in Alberta. Cargoes route through Vancouver &amp; Prince Rupert (Asia-Pacific), Thunder Bay &amp; Montreal (Europe/Atlantic), and Houston (LATAM).`, chips:['What do you trade?','Get a quote'] };
    if (has('freight','panamax','capesize','shipping rate','dry bulk','vessel'))
      return { html:`Freight is structurally tight on Pacific routes right now — our <a href="/insights-freight-2026">freight note</a> explains why and what it does to CFR vs FOB out of Vancouver.`, chips:['CFR vs CIF?','Get a quote'] };
    if (has('insight','market','news','outlook','commentary','blog','report'))
      return { html:`Notes from the desk: <a href="/insights">Market Insights</a>. Latest — canola outlook, red lentils &amp; India, dry-bulk freight.`, chips:['Canola','Lentils','Freight'] };
    if (has('about','who are you','company','tell me about','history'))
      return { html:`Mercatorum is a Canadian merchant house — a focused desk with global reach, connecting named Canadian producers to buyers in 40+ countries. More: <a href="/about">about page</a>.`, chips:['What do you trade?','Get a quote'] };

    // 13b) how a trade works / process
    if (has('how does','how do you','process','how it works','how a trade','steps','workflow','how would','how can i','get started','first step'))
      return { html:`How a trade runs with us:<br><br><strong>1.</strong> You send an LOI (commodity, volume, port, terms).<br><strong>2.</strong> We do a light KYC + check supply &amp; freight.<br><strong>3.</strong> We issue a <strong>firm offer</strong> (price, terms, validity).<br><strong>4.</strong> Agree → soft contract → you open the LC (or agreed instrument).<br><strong>5.</strong> We ship, inspect (SGS/Intertek), and present documents for payment.<br><br>Want to start one now?`, chips:[{label:'Book an inquiry',cta:true},'Payment terms?','Documents needed'] };

    // 13c) trade finance — LC mechanics, SBLC, performance bond, escrow, credit insurance
    if (has('letter of credit','l/c','lc at sight','documentary credit','dlc','payment term','payment','how do i pay','how do we pay','pay you','payment instrument','terms of payment'))
      return { html:`We work to an <strong>irrevocable LC at sight</strong>, ideally confirmed by a Tier-1 bank — that's the standard. Once your bank issues the LC against the agreed terms, we ship and present documents (BL, invoice, CoO, inspection) to draw payment. Deferred LC (30/60/90), TT, and CAD are case-by-case; open account for established counterparties.`, chips:['What is SBLC?','Performance bond?',{label:'Book an inquiry',cta:true}] };
    if (has('sblc','standby'))
      return { html:`An <strong>SBLC</strong> (standby letter of credit) is a bank guarantee that pays if a party defaults — a backstop, not the primary payment route. For first trades we usually transact on a confirmed LC at sight rather than relying on SBLCs.`, chips:['Payment terms?','Performance bond?'] };
    if (has('performance bond','pb ','2%','guarantee'))
      return { html:`On larger contracts we can post a <strong>2% performance bond</strong> once the LC is operative — and we may ask a first-time buyer for one too. It's negotiable and set per deal after KYC.`, chips:['Payment terms?',{label:'Book an inquiry',cta:true}] };
    if (has('escrow'))
      return { html:`We can use <strong>escrow</strong> for one-off or first-time trades where neither side wants to go first — funds release against agreed shipping documents. LC is still our default for bulk.`, chips:['Payment terms?','How does a trade work?'] };
    if (has('credit insurance','trade credit','open account'))
      return { html:`For repeat counterparties we can extend <strong>open-account</strong> terms backed by trade-credit insurance. New buyers start on LC; we build to open account over a track record.`, chips:['Payment terms?',{label:'Book an inquiry',cta:true}] };

    // 13d) KYC / NCND / confidentiality / legitimacy
    if (has('kyc','know your customer','due diligence','verify me','onboard'))
      return { html:`KYC is light and quick: certificate of incorporation, beneficial-ownership, a sanctions/PEP screen, and one trade reference. ~10 minutes of paperwork on your side. It protects both of us.`, chips:[{label:'Book an inquiry',cta:true},'Do we sign an NCND?'] };
    if (has('ncnd','non-circumvent','non circumvent','confidential','nda','discreet','discretion'))
      return { html:`A <strong>mutual NCND</strong> covers every inquiry from the moment you submit — we don't shop your trade around the market, you don't approach our producers directly. Formal NCND/MFPA can be signed before you share specifics if you prefer.`, chips:[{label:'Book an inquiry',cta:true},'KYC process?'] };
    if (has('broker','middleman','intermediary','agent','commission','mandate'))
      return { html:`We're a <strong>principal</strong>, not a broker — we take title to the cargo and carry the quality, documents, and risk. We do work with verified buy-side mandates and agents under NCND; tell us your role and we'll structure it.`, chips:[{label:'Book an inquiry',cta:true},'How does a trade work?'] };
    if (has('scam','legit','real company','trust you','is this real','fraud'))
      return { html:`Fair question in this business. We transact on bank instruments (confirmed LC), independent inspection (SGS/Intertek), and full documentary trade — nothing moves on trust alone. Reach the desk directly at <a href="mailto:sales@mercatorum.ca">sales@mercatorum.ca</a> and we'll verify both ways via KYC.`, chips:['KYC process?','Documents needed'] };

    // 13e) ports / logistics / lead times
    if (has('port','ship from','load port','vancouver','prince rupert','thunder bay','montreal','transit time','how long','shipping time','lead time','laycan','demurrage'))
      return { html:`We load mainly out of <strong>Vancouver</strong> &amp; <strong>Prince Rupert</strong> (Asia-Pacific), <strong>Thunder Bay</strong>/<strong>Montreal</strong> (Europe &amp; Atlantic), and <strong>Houston</strong> (LATAM). Typical lead time from firm contract to vessel is 3–6 weeks depending on commodity and laycan; container lots are faster. Demurrage/laytime terms are set in the contract.`, chips:[{label:'Book an inquiry',cta:true},'Freight market?'] };

    // 13f) certifications / sustainability / GMO / organic
    if (has('non-gmo','non gmo','gmo','organic','sustainable','certif','iscc','rspo','traceab','origin guarantee'))
      return { html:`Canadian grain is graded and certified by the <strong>Canadian Grain Commission</strong>. We can source non-GMO and identity-preserved lots, and certified-organic on selected pulses/grains with lead time. ISCC/sustainability certification available where the supply chain supports it — tell us the requirement.`, chips:[{label:'Book an inquiry',cta:true},'Documents needed'] };

    // 13g) specs / grades
    if (has('spec','grade','protein','oil content','moisture','api','quality','analysis'))
      return { html:`Specs are contract-binding and we quote to your target — e.g. wheat by protein &amp; falling number, canola by oil content &amp; admixture, crude by API &amp; sulphur. Send your spec sheet with the inquiry and the trader matches supply to it.`, chips:[{label:'Book an inquiry',cta:true},'Documents needed'] };

    // 13h) more Incoterms
    if (has('exw','ex works')) return { html:`<strong>EXW</strong> — Ex Works. Buyer collects from our premises and handles everything onward, including export clearance. Rare for bulk; we usually quote FOB or better.`, chips:['What is FOB?','CFR vs CIF?'] };
    if (has('fas')) return { html:`<strong>FAS</strong> — Free Alongside Ship. Seller delivers alongside the vessel at the load port; buyer loads and carries from there. Used for some bulk and project cargo.`, chips:['What is FOB?','Get a quote'] };
    if (has('cpt')) return { html:`<strong>CPT</strong> — Carriage Paid To. Seller pays carriage to the named place; risk passes when handed to the first carrier. Multimodal cousin of CFR.`, chips:['CFR vs CIF?','What is FOB?'] };
    if (has('cip')) return { html:`<strong>CIP</strong> — Carriage &amp; Insurance Paid To. Like CPT but seller also buys insurance (all-risk) to the destination. Multimodal cousin of CIF.`, chips:['What is CIF?','What is FOB?'] };
    if (has('dpu')) return { html:`<strong>DPU</strong> — Delivered at Place Unloaded. Seller delivers and unloads at the named place, bearing risk to that point. Buyer handles import.`, chips:['What is DAP?','Get a quote'] };
    if (has('ddp')) return { html:`<strong>DDP</strong> — Delivered Duty Paid. Maximum seller obligation: delivered, cleared for import, duties paid. We rarely quote DDP on bulk.`, chips:['What is DAP?','Get a quote'] };
    if (has('best incoterm','which incoterm','recommend','fob or cif','cif or fob','should i use'))
      return { html:`Rule of thumb: if you have your own freight &amp; insurance, take it <strong>FOB</strong> (most control, lowest price). If you'd rather we handle the voyage, go <strong>CFR</strong> (we book freight) or <strong>CIF</strong> (freight + insurance). The trader will advise per route.`, chips:['CFR vs CIF?','What is FOB?',{label:'Book an inquiry',cta:true}] };

    // 13i) sanctions / compliance
    if (has('sanction','compliance','ofac','embargo','restricted'))
      return { html:`We screen every counterparty and destination against OFAC/EU/UN sanctions lists and won't transact where prohibited. Clean compliance is a condition of every contract.`, chips:['KYC process?',{label:'Book an inquiry',cta:true}] };

    // 14) thanks / acknowledgements
    if (has('thank','thanks','thx','cheers','appreciate','perfect','got it','that helps','great help'))
      return { html:`Anytime. Ready for a price, the <a href="/contact#loi">LOI form</a> reaches the desk directly — otherwise ask me anything else.`, chips:['Submit an LOI','What do you trade?'] };
    if (has('bye','goodbye','later','cya','that\'s all'))
      return { html:`Cheers — close the panel whenever. The desk's always here: <a href="/contact">contact</a>.`, chips:['Get a quote'] };

    // 15) fallback (acknowledge context)
    const ctx = state.lastCommodity ? ` We were talking about <strong>${state.lastCommodity}</strong> — want a quote on that?` : '';
    return { html:`Happy to help — could you say that another way? I'm good with simple questions too. For example:<br><br>• <em>"What do you sell?"</em><br>• <em>"How do I buy from you?"</em><br>• <em>"Where are you based?"</em><br>• <em>"How do I get a price?"</em>${ctx}<br><br>Or just tell me what you're after and I'll point you the right way — or reach a real trader at <a href="mailto:sales@mercatorum.ca">sales@mercatorum.ca</a>.`,
             chips: ['What do you sell?','How do I buy?','Get a price','Talk to a human'] };
  }

  /* ============================ INIT ============================ */
  // restore history
  if (load() && state.history.length){
    state.history.forEach(h => pushMsg(h.who, h.html, h.t, false));
    setQuick(defaultChips());
  }
  // greeting nudge after a delay (once per session, if not opened)
  if (!sessionStorage.getItem('mercatorum_nudge_dismissed') && state.history.length === 0){
    setTimeout(()=>{ if (!opened){ nudge.classList.add('is-shown'); badge.classList.add('is-shown'); } }, 6000);
    setTimeout(()=>{ if (!opened){ nudge.classList.remove('is-shown'); } }, 16000);
  }
})();
