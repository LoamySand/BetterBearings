// Parses req.body with a zod schema; on failure returns 400 with every field error.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.slice(0, 20).map((i) => ({
      path: i.path.join('.'), // e.g. "streets.12.coordinates.0.3.0"
      message: i.message,
    }));
    // Top-level message is the first error, so the existing client UI shows something useful
    return res.status(400).json({ message: errors[0].message, errors });
  }
  req.body = result.data; // trimmed, lowercased, unknown keys stripped
  next();
};

module.exports = { validate };