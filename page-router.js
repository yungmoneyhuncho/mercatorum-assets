/* Mercatorum page router — injects custom page content into empty Squarespace pages by URL */
(function(){
  if (window.__mercatorum_router) return;
  window.__mercatorum_router = true;
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
