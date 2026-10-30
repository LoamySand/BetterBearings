const { z } = require('zod');

// bcrypt reads only the first 72 bytes and silently ignores the rest
const MAX_PASSWORD_BYTES = 72;

// Structural caps, provisional until measured (step 3). The 1.5mb body limit is the outer bound.
// Mirrors the client cap in CreateStreetSetModal.jsx (numberOfQuestions: 200). Change both together.
const MAX_STREETS = 200;
const MAX_LINES_PER_STREET = 500;  // 94 measured at ~2 km; long arterials scale with diameter
const MAX_POINTS_PER_LINE = 2000;  // OSM's limit on nodes per way

// ---- Auth ----

const email = z.string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'Email is too long' })
  .pipe(z.email({ error: 'Enter a valid email address' }));

const signupSchema = z.object({
  username: z.string({ error: 'Username is required' })
    .trim()
    .min(3, { error: 'Username must be at least 3 characters' })
    .max(30, { error: 'Username must be at most 30 characters' })
    .regex(/^[A-Za-z0-9_.-]+$/, { error: 'Username can use letters, numbers, _ . and -' }),
  email,
  password: z.string({ error: 'Password is required' })
    .min(12, { error: 'Password must be at least 12 characters' })
    .refine((p) => Buffer.byteLength(p, 'utf8') <= MAX_PASSWORD_BYTES, {
      error: 'Password is too long (72 bytes max)',
    }),
});

// No strength rules on login: accounts made under the old 6-character rule must still get in
const loginSchema = z.object({
  email: z.string({ error: 'Email is required' }).trim().toLowerCase().min(1, { error: 'Email is required' }).max(254),
  password: z.string({ error: 'Password is required' }).min(1, { error: 'Password is required' }).max(1024),
});

// ---- Street sets ----

const lat = z.number().min(-90, { error: 'Latitude must be between -90 and 90' })
  .max(90, { error: 'Latitude must be between -90 and 90' });
const lng = z.number().min(-180, { error: 'Longitude must be between -180 and 180' })
  .max(180, { error: 'Longitude must be between -180 and 180' });

const point = z.tuple([lat, lng]); // client order is [lat, lng]
const line = z.array(point).min(2, { error: 'A line needs at least 2 points' }).max(MAX_POINTS_PER_LINE);

const street = z.object({
  osmId: z.int().positive().nullish(),
  name: z.string().trim().min(1, { error: 'Street name is required' }).max(200),
  alternativeName: z.string().max(200).nullish(),
  type: z.string().max(50).nullish(),
  length: z.number().nonnegative().nullish(),
  width: z.number().nonnegative().nullish(),
  isEnclosedArea: z.boolean().optional(),
  included: z.boolean().optional(),
  difficulty: z.int().min(1).max(3).optional(),
  coordinates: z.array(line).min(1).max(MAX_LINES_PER_STREET),
});

const streets = z.array(street)
  .min(1, { error: 'A street set needs at least one street' })
  .max(MAX_STREETS, { error: `A street set can have at most ${MAX_STREETS} streets` });

const name = z.string().trim().min(1, { error: 'Name is required' }).max(100);
const description = z.string().trim().max(1000).nullish();

const createStreetSetSchema = z.object({
  name,
  description,
  center: z.object({ lat, lng }),
  radius: z.number().positive().max(5000, { error: 'Radius can be at most 5000 m' }),
  streets,
});

const updateStreetSetSchema = z.object({
  name: name.optional(),
  description,
  streets: streets.optional(),
});

module.exports = { signupSchema, loginSchema, createStreetSetSchema, updateStreetSetSchema };