/**
 * Wraps an async Express route handler so any rejected promise is
 * forwarded to Express's error middleware via next(err), instead of
 * becoming an unhandled promise rejection that can crash the whole
 * serverless function instance.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
