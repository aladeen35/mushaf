/* HafM.list — serve https://hafm-list.albushra.app from GitHub Pages (aladeen35.github.io/mushaf/HafM.list/).
   Cloudflare dashboard → Workers & Pages → Create → Worker → paste this → Deploy →
   Settings → Domains & Routes → Add → Custom domain → hafm-list.albushra.app
   (A custom domain on this worker takes precedence over the *.albushra.app hub route.) */
const ORIGIN = 'https://aladeen35.github.io/mushaf/HafM.list';
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path === '/' || path === '') path = '/index.html';
    const upstream = await fetch(ORIGIN + path + url.search, {
      headers: {'User-Agent': request.headers.get('User-Agent') || 'hafm-list'},
      cf: {cacheTtl: 120, cacheEverything: true}
    });
    const res = new Response(upstream.body, upstream);
    res.headers.set('x-albushra-app', 'hafm-list');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.headers.delete('x-github-request-id');
    return res;
  }
};
