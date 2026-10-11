// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
// The Nest app is built once per warm instance from the compiled apps/api/dist.
const { createRequestHandler } = require('../apps/api/dist/serverless');

let handlerPromise;

module.exports = async (req, res) => {
    handlerPromise ??= createRequestHandler();
    const handler = await handlerPromise;
    handler(req, res);
};
