# Technician ticket from complaint review

Agreement gate passed with notes from all five supporting agents. Backend and
Security initially requested that the complaint fields and scope constraints be
made explicit; the final plan treats the ticket as the maintenance record,
does not overwrite report-derived complaint facts or status, and adds a
composite organization/region foreign key.

Implementation evidence:

- `npm run typecheck` passes.
- Targeted ESLint passes for the changed complaint, ticket, schema, action, and
  permission files.
- `npm run check:hex` passes.
- Focused unit tests pass: permissions, complaint screens, and page guards,
  96 tests total. The broader suite still needs the local Postgres server for
  integration tests; the repository's separate Node 20 / Vitest
  `Map.groupBy` compatibility issue remains outside this feature.
