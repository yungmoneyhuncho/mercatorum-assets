/* Mercatorum page router — injects custom page content into empty Squarespace pages by URL */
(function(){
  if (window.__mercatorum_router) return;
  window.__mercatorum_router = true;

  /* --- Site-wide: rewrite legacy ".html" links to clean Squarespace slugs ---
     Runs on EVERY page (home included), catches links added later (chat bubbles,
     mobile nav) via a MutationObserver, and fixes any straggler on click. */
  (function(){
    var H = {
      'index.html':'/', 'home.html':'/',
      'products.html':'/products', 'insights.html':'/insights',
      'knowledge.html':'/knowledge', 'about.html':'/about', 'contact.html':'/contact',
      'insights-canola-2026.html':'/insights-canola-2026',
      'insights-lentils-2026.html':'/insights-lentils-2026',
      'insights-freight-2026.html':'/insights-freight-2026'
    };
    function clean(h){
      if (!h || /^(https?:|mailto:|tel:|javascript:)/i.test(h)) return null;
      var hi = h.indexOf('#'), hash = hi > -1 ? h.slice(hi) : '', path = hi > -1 ? h.slice(0, hi) : h;
      var k = path.replace(/^\.?\//, '');
      if (H[k] !== undefined) return H[k] + hash;
      if (/^[\w-]+\.html$/.test(k)) return '/' + k.replace(/\.html$/, '') + hash;
      return null;
    }
    function fix(a){ var c = clean(a.getAttribute('href')); if (c !== null) a.setAttribute('href', c); }
    function sweep(root){ var L = (root || document).querySelectorAll('a[href]'); for (var i=0;i<L.length;i++) fix(L[i]); }
    function start(){
      sweep(document);
      try {
        new MutationObserver(function(muts){
          for (var i=0;i<muts.length;i++){
            var nodes = muts[i].addedNodes;
            for (var j=0;j<nodes.length;j++){
              var n = nodes[j];
              if (n.nodeType !== 1) continue;
              if (n.matches && n.matches('a[href]')) fix(n);
              if (n.querySelectorAll) sweep(n);
            }
          }
        }).observe(document.documentElement, { childList:true, subtree:true });
      } catch(e){}
      document.addEventListener('click', function(e){
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (a) fix(a);
      }, true);
    }
    if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
  })();

  var MAP = {
    '/products':'products', '/insights':'insights', '/knowledge':'knowledge',
    '/about':'about', '/contact':'contact',
    '/insights-canola-2026':'insights-canola-2026',
    '/insights-lentils-2026':'insights-lentils-2026',
    '/insights-freight-2026':'insights-freight-2026'
  };
  var key = location.pathname.replace(/\/+$/,'') || '/';
  var name = MAP[key];
  if (!name) return; // home + unknown paths untouched
  var base = 'https://cdn.jsdelivr.net/gh/yungmoneyhuncho/mercatorum-assets@main/pages/';
  fetch(base + name + '.body.html').then(function(r){ return r.text(); }).then(function(html){
    var o = document.createElement('div');
    o.className = 'm-fullbleed';
    o.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;overflow-y:auto;overflow-x:hidden;z-index:3;background:#F5F1E8;-webkit-overflow-scrolling:touch;';
    o.innerHTML = html;
    document.body.appendChild(o);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    // innerHTML doesn't execute <script> — re-create them so converters/forms/tabs work
    o.querySelectorAll('script').forEach(function(old){
      var s = document.createElement('script');
      if (old.src) s.src = old.src; else s.textContent = old.textContent;
      document.body.appendChild(s);
    });
    try { window.scrollTo(0,0); } catch(e){}
  }).catch(function(e){ console.error('Mercatorum router:', e); });
})();
