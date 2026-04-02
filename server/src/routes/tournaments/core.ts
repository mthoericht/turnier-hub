import type { NextFunction, Router } from "express";
import type { TournamentMode, TournamentPhase } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { createdBySelect, parseListScope, toCreatedBy } from "../../lib/createdBy.js";
import {
  loadTournamentById,
  requireTournamentOwner,
  serializeTournamentDetail,
} from "./shared.js";
import {
  notifyTournamentChanged,
  notifyUserTournamentsChanged,
} from "../../realtime/notify.js";

const createTournamentSchema = z.object({
  name: z.string().min(1),
  sport: z.string().min(1),
  mode: z.enum(["GROUP_KO", "DIRECT_KO", "ROUND_ROBIN"]).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
  teamsAreIndividuals: z.boolean().optional(),
});

const patchTournamentSchema = z.object({
  name: z.string().min(1).optional(),
  sport: z.string().min(1).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
});

export function registerTournamentCoreRoutes(router: Router): void
{
  router.get("/", async (req, res) =>
  {
    const scope = parseListScope(req.query.scope);
    const where = scope === "own" ? { userId: req.userId! } : {};
    const list = await prisma.tournament.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: createdBySelect },
        _count: { select: { teams: true, matches: true } },
      },
    });
    res.json(
      list.map(({ user, ...row }) => ({
        ...row,
        createdBy: toCreatedBy(user),
      }))
    );
  });

  router.post("/", async (req, res, next: NextFunction) =>
  {
    const parsed = createTournamentSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Eingaben" });
      return;
    }
    const mode: TournamentMode = parsed.data.mode ?? "GROUP_KO";
    const defaultPhase: TournamentPhase = mode === "DIRECT_KO"
      ? "QUARTER"
      : "GROUP";
    try
    {
      const t = await prisma.tournament.create({
        data: {
          name: parsed.data.name,
          sport: parsed.data.sport,
          mode,
          phase: defaultPhase,
          groupCount: parsed.data.groupCount ?? 1,
          userId: req.userId!,
          advancesPerGroup: parsed.data.advancesPerGroup ?? 2,
          teamsAreIndividuals: parsed.data.teamsAreIndividuals ?? false,
        },
        include: {
          user: { select: createdBySelect },
          _count: { select: { teams: true, matches: true } },
        },
      });
      const { user, ...row } = t;
      notifyUserTournamentsChanged(req.userId!);
      res.status(201).json({
        ...row,
        createdBy: toCreatedBy(user),
      });
    }
    catch (err)
    {
      next(err);
    }
  });

  router.get("/:id", async (req, res) =>
  {
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }
    res.json(serializeTournamentDetail(t));
  });

  router.patch("/:id", async (req, res) =>
  {
    const parsed = patchTournamentSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Eingaben" });
      return;
    }
    const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
    if (!owned) return;
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    const full = await loadTournamentById(req.params.id);
    notifyTournamentChanged(req.params.id);
    notifyUserTournamentsChanged(req.userId!);
    res.json(serializeTournamentDetail(full!));
  });

  router.delete("/:id", async (req, res) =>
  {
    const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
    if (!owned) return;
    const tid = req.params.id;
    await prisma.tournament.delete({ where: { id: tid } });
    notifyTournamentChanged(tid);
    notifyUserTournamentsChanged(req.userId!);
    res.status(204).send();
  });
}
