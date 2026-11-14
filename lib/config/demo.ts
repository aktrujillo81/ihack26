/**
 * The `configuration` key that `npm run db:seed:demo` writes, in the same
 * transaction as the invented demo data. While that row exists in the signed-in
 * user's organization and regions, the screens say "Sample data". It lives here,
 * not in db/seed, so the data layer can read it without importing the seed.
 */
export const DEMO_DATA_MARKER_KEY = "demo_seed";
