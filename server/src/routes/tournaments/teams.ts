import type { Request, Response, Router } from "express";
import { z } from "zod";
import { getUserSchoolId, requireTournamentExists } from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  createTeam,
  patchTeam,
  deleteTeam,
  renameGroup,
  addMember,
  removeMember,
  transferTeam,
} from "../../services/tournamentRosterService.js";

/** Request body schema for creating a tournament team. */
const createTeamSchema = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().optional(),
});

/** Request body schema for patching team properties. */
const patchTeamSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

/** Request body schema for renaming a group label. */
const renameGroupSchema = z.object({
  oldLabel: z.string().trim().min(1).max(40),
  newLabel: z.string().trim().min(1).max(40),
});

/** Request body schema for adding one player to a team roster. */
const addMemberSchema = z.object({
  playerId: z.string(),
});

/** Request body schema for roster transfer options. */
const transferTeamBodySchema = z.object({
  overwriteExistingMembers: z.boolean().optional(),
});

/** POST /:id/teams - creates a new team in the tournament. */
async function createTeamHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;

  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Mannschaftsdaten" });
    return;
  }
  const team = await createTeam(
    tournamentId,
    parsed.data.name.trim(),
    parsed.data.sortOrder,
  );
  notifyTournamentChanged(tournamentId);
  res.status(201).json(team);
}

/** PATCH /:id/teams/:teamId - updates team metadata. */
async function patchTeamHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const teamId = String(req.params.teamId);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;

  const parsed = patchTeamSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const team = await patchTeam(tournamentId, teamId, parsed.data);
  notifyTournamentChanged(tournamentId);
  res.json(team);
}

/** DELETE /:id/teams/:teamId - deletes one team from the tournament. */
async function deleteTeamHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const teamId = String(req.params.teamId);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;

  const result = await deleteTeam(
    tournamentId,
    teamId,
    owned.teamsAreIndividuals,
  );
  notifyTournamentChanged(tournamentId);
  res.status(200).json(result);
}

/** PATCH /:id/groups/rename - renames a group label within one tournament. */
async function renameGroupHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;

  const parsed = renameGroupSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Gruppennamen" });
    return;
  }
  const detail = await renameGroup(
    tournamentId,
    parsed.data.oldLabel,
    parsed.data.newLabel,
  );
  notifyTournamentChanged(tournamentId);
  res.json(detail);
}

/** POST /:id/teams/:teamId/members - adds one player to a team roster. */
async function addMemberHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const teamId = String(req.params.teamId);
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Spieler erforderlich" });
    return;
  }

  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;

  const member = await addMember(
    tournamentId,
    teamId,
    parsed.data.playerId,
  );
  notifyTournamentChanged(tournamentId);
  res.status(201).json(member);
}

/** DELETE /:id/teams/:teamId/members/:playerId - removes one roster member. */
async function removeMemberHandler(req: Request, res: Response): Promise<void>
{
  const tournamentId = String(req.params.id);
  const teamId = String(req.params.teamId);
  const playerId = String(req.params.playerId);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const owned = await requireTournamentExists(res, tournamentId, schoolId);
  if (!owned) return;
  await removeMember(tournamentId, teamId, playerId);
  notifyTournamentChanged(tournamentId);
  res.status(204).send();
}

/** POST /:id/transfer-team-from/:sourceTournamentId - copies teams from source to target tournament. */
async function transferTeamHandler(req: Request, res: Response): Promise<void>
{
  const targetTournamentId = String(req.params.id);
  const sourceTournamentId = String(req.params.sourceTournamentId);
  const schoolId = await getUserSchoolId(req.userId!);
  if (!schoolId) {
    res.status(404).json({ error: "Benutzer nicht gefunden" });
    return;
  }
  const parsed = transferTeamBodySchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }

  const targetOwned = await requireTournamentExists(res, targetTournamentId, schoolId);
  if (!targetOwned) return;

  const sourceOwned = await requireTournamentExists(
    res,
    sourceTournamentId,
    schoolId
  );
  if (!sourceOwned) return;

  const result = await transferTeam(
    targetTournamentId,
    sourceTournamentId,
    parsed.data.overwriteExistingMembers ?? false,
  );
  notifyTournamentChanged(targetTournamentId);
  notifyTournamentChanged(sourceTournamentId);
  res.json(result);
}

/** Registers team, roster-member, and group-rename tournament routes. */
export function registerTournamentTeamRoutes(router: Router): void
{
  router.post("/:id/teams", asyncHandler(createTeamHandler));
  router.patch("/:id/teams/:teamId", asyncHandler(patchTeamHandler));
  router.delete("/:id/teams/:teamId", asyncHandler(deleteTeamHandler));
  router.patch("/:id/groups/rename", asyncHandler(renameGroupHandler));
  router.post("/:id/teams/:teamId/members", asyncHandler(addMemberHandler));
  router.delete("/:id/teams/:teamId/members/:playerId", asyncHandler(removeMemberHandler));
  router.post("/:id/transfer-team-from/:sourceTournamentId", asyncHandler(transferTeamHandler));
}
