# Prisma-Schema Notizen

Dieses Verzeichnis enthält das Prisma-Schema für die Backend-Datenbank.

## Schnelles mentales Modell

Bei Relations in Prisma gibt es in der Regel:

- ein skalares Foreign-Key-Feld (`tournamentId`, `homeTeamId`, `awayTeamId`)
- ein Relationsfeld (`tournament`, `homeTeam`, `awayTeam`)

Skalare Felder nutzt du für direkte ID-Filter und Updates.  
Relationsfelder nutzt du für `include`, verschachtelte Writes und relationsbasierte Filter.

## Match-Relationen (`model Match`)

Das `Match`-Modell referenziert ein Turnier und bis zu zwei Teams:

- `tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)`
  - Jedes Match gehört genau zu einem Turnier.
  - `tournamentId` ist der Foreign Key.
  - Wenn ein Turnier gelöscht wird, werden alle zugehörigen Matches automatisch gelöscht (`Cascade`).

- `homeTeam TournamentTeam? @relation("HomeTeam", fields: [homeTeamId], references: [id], onDelete: SetNull)`
- `awayTeam TournamentTeam? @relation("AwayTeam", fields: [awayTeamId], references: [id], onDelete: SetNull)`
  - Beide Team-Relationen sind optional (`?`), daher dürfen `homeTeamId` / `awayTeamId` `NULL` sein.
  - Wenn ein referenziertes Team gelöscht wird, setzt Prisma den jeweiligen Foreign Key auf `NULL` (`SetNull`) statt das Match zu löschen.
  - Die Relationsnamen (`"HomeTeam"` / `"AwayTeam"`) sind nötig, weil beide Felder auf dasselbe Zielmodell (`TournamentTeam`) zeigen.

## Indizes

Die folgenden Indizes beschleunigen typische Abfragen:

- `@@index([tournamentId])`: schnellere Abfragen wie "alle Matches von Turnier X".
- `@@index([homeTeamId])`: schnelle Lookups nach Heimteam.
- `@@index([awayTeamId])`: schnelle Lookups nach Auswärtsteam.

## TypeScript-Client Nutzung (`include` / `where`)

Prisma erzeugt auf `Match` die Relationsfelder anhand der Schemadefinition:

- `homeTeam` für die Relation `"HomeTeam"`
- `awayTeam` für die Relation `"AwayTeam"`

### Beide Teams inkludieren

```ts
const matches = await prisma.match.findMany({
  where: { tournamentId },
  include: {
    homeTeam: true,
    awayTeam: true,
  },
});
```

### `select` nutzen, wenn du nur wenige Felder brauchst

`include` liefert komplette verknüpfte Objekte. Wenn du nur Teilmengen brauchst, ist `select` meist besser:

```ts
const matches = await prisma.match.findMany({
  where: { tournamentId },
  select: {
    id: true,
    homeScore: true,
    awayScore: true,
    homeTeam: { select: { id: true, name: true } },
    awayTeam: { select: { id: true, name: true } },
  },
});
```

### Nach einem konkreten Team filtern (home ODER away)

```ts
const teamMatches = await prisma.match.findMany({
  where: {
    tournamentId,
    OR: [
      { homeTeamId: teamId },
      { awayTeamId: teamId },
    ],
  },
  include: {
    homeTeam: true,
    awayTeam: true,
  },
});
```

### Nach Feldern der Relation filtern

```ts
const matchesWithNamedHomeTeam = await prisma.match.findMany({
  where: {
    homeTeam: {
      is: {
        name: {
          contains: "A",
        },
      },
    },
  },
  include: {
    homeTeam: true,
    awayTeam: true,
  },
});
```

### Nach fehlenden Teams filtern (`NULL`-Foreign-Keys)

```ts
const incompleteMatches = await prisma.match.findMany({
  where: {
    OR: [
      { homeTeamId: null },
      { awayTeamId: null },
    ],
  },
});
```

### Nullable Relations sauber behandeln

Da `homeTeam` und `awayTeam` im Schema optional sind (`TournamentTeam?`), sind die generierten TypeScript-Typen nullable:

```ts
for (const match of matches)
{
  const homeName = match.homeTeam?.name ?? "Offen";
  const awayName = match.awayTeam?.name ?? "Offen";
  console.log(`${homeName} vs ${awayName}`);
}
```

## Häufiges Query-Muster für Match-Listen

Für UI-Listen kombinierst du typischerweise Filter + Sortierung + Pagination:

```ts
const pageSize = 20;
const page = 0;

const result = await prisma.match.findMany({
  where: { tournamentId },
  include: {
    homeTeam: true,
    awayTeam: true,
  },
  orderBy: [
    { roundOrder: "asc" },
    { id: "asc" },
  ],
  skip: page * pageSize,
  take: pageSize,
});
```

## Nach Schema-Änderungen

Typischer lokaler Ablauf aus dem Repository-Root:

1. `server/prisma/schema.prisma` anpassen
2. Schema-Änderungen in die DB übernehmen: `npm run db:push`
3. Prisma-Client-Typen neu generieren: `npm run db:generate`

Wenn du Optionalität (`?`) oder Delete-Verhalten (`onDelete`) geändert hast, prüfe danach die betroffene Service-Logik und das Null-Handling in TypeScript.
