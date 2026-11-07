// Parses req.body (or req.query) with a zod schema; on failure returns 400 with every field error.
// Express 5's req.query is read-only, so parsed query params go to req.validatedQuery.
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(source === 'query' ? req.query : req.body);
    if (!result.success) {
      const errors = result.error.issues.slice(0, 20).map((i) => ({
        path: i.path.join('.'), // e.g. "streets.12.coordinates.0.3.0"
        message: i.message,
      }));
      // Top-level message is the first error, so the existing client UI shows something useful
      return res.status(400).json({ message: errors[0].message, errors });
    }
    // trimmed, lowercased, unknown keys stripped
    if (source === 'query') req.validatedQuery = result.data;
    else req.body = result.data;
    next();
  };

module.exports = { validate };
