# Database

Self-hosted PostgreSQL. Schema, migrations, seed data, and database
configuration belong here. Every table must include organization and region
ownership as required by the spec.

Postgres listens only on the host server and is never exposed to the
internet. Only the Next.js server connects to it, using `DATABASE_URL`.
