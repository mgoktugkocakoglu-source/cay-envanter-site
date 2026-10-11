// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
// The Nest app is built once per warm instance from the compiled apps/api/dist.
const { createRequestHandler } = require('../apps/api/dist/serverless');

let handlerPromise;

/**
 * The /api/:path* rewrite appends the captured segments as `?path=…`. The API's
 * ValidationPipe forbids unknown query params, so drop it when it is exactly
 * that echo of the request path (a genuine `path` param would differ).
 */
function stripRewriteParam(req) {
    const url = new URL(req.url, 'http://localhost');
    const echoed = url.pathname.replace(/^\/api\/?/, '');
    const injected = url.searchParams.getAll('path');
    if (injected.length > 0 && injected.join('/') === echoed) {
        url.searchParams.delete('path');
        req.url = url.pathname + url.search;
    }
}

module.exports = async (req, res) => {
    stripRewriteParam(req);
    handlerPromise ??= createRequestHandler();
    const handler = await handlerPromise;
    handler(req, res);
};
