// Vercel serverless entry point. vercel.json rewrites every request to
// this function; the Express app still owns real routing.
module.exports = require('../src/server');
