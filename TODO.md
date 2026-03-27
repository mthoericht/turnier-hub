# TODO — Tournament System Refactoring

All items in this checklist are implemented.

## Renaming (German UI labels, English code)
- [x] Preliminary matches -> Group matches
- [x] Squad -> Teams

## Tournament creation (wizard)
- [x] Start with group stage / direct knockout start
- [x] Round-robin mode
- [x] Teams can represent individuals (for example badminton)

## Tournament modes
- [x] Classic group stage (`GROUP_KO`) -> quarter/semi/final
- [x] Direct knockout (`DIRECT_KO`), including 10+ teams and byes
- [x] Round-robin (`ROUND_ROBIN`) with no knockout
- [x] Individual participants mode (`teamsAreIndividuals`)

## Phases and structure
- [x] Tournament phases: group/round-robin -> knockout
- [x] Knockout phase uses standalone teams (group no longer matters)
- [x] Round of 16 (`ROUND_OF_16`) for larger tournaments

## Parallel match rounds
- [x] Group and round-robin matches sorted into parallel rounds

## Match operations
- [x] Delete all matches at once (danger zone, `DELETE /api/tournaments/:id/matches`)
- [x] Group count configured directly next to the generate button
- [x] Advancers per group saved separately
- [x] Teams without members excluded from group generation
- [x] Existing knockout matches removed when regenerating group matches
- [x] Danger-zone button text updated to "Delete all matches and groups"
- [x] Top-level navigation includes "Spielbetrieb" next to "Spiele"

## Seed data
- [x] Four demo tournaments (`GROUP_KO`, `DIRECT_KO`, `DIRECT_KO` with 15 teams, `ROUND_ROBIN`)
- [x] 12 demo players and demo school classes

## Tests and infrastructure
- [x] Vitest for server (unit + integration against test DB)
- [x] Vitest for client (unit + client-API integration)
- [x] Tests organized centrally under `tests/` (server/client)
- [x] Tournament routes modularized in `server/src/routes/tournaments/`
- [x] Seed fixtures extracted to reusable module (`server/src/seed/demoSeed.ts`)
- [x] Client TS config cleaned up (`tsconfig.base.json`), `*.tsbuildinfo` removed/ignored
- [x] Faster client integration tests via minimal per-test seeding
- [x] Unit tests added for key knockout helpers (`randomizeTeamIds`, `interleavedPairings`)

## UX improvements
- [x] Group names can be renamed in roster
- [x] Team names can be renamed in roster
- [x] Exact knockout phase shown in phase UI (R16/QF/SF/Final instead of generic KO)
- [x] "Add player to team" moved above team list and extracted as component
- [x] Add-member/add-participant merged into shared `TournamentAddMemberSection`

## Phase automation
- [x] Tournament automatically transitions to `COMPLETED` after final is finished

## Knockout draw and byes
- [x] Randomized knockout pairings (direct KO and advancement from qualifiers)
- [x] Bye matches created directly as `FINISHED`
