// Express 4 doesn't catch rejected promises from async handlers; forward them to the
// error-handling middleware so a thrown error can never become an unhandled rejection.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
