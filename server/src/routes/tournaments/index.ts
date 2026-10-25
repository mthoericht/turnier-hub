import { Router } from "express";
import { registerTournamentCoreRoutes } from "./core.js";
import { registerTournamentTeamRoutes } from "./teams.js";
import { registerTournamentMatchRoutes } from "./matches.js";
import { registerTournamentStandingsAdvanceRoutes } from "./standings-advance.js";

/** Tournament router mounted under `/api/tournaments`. */
const router = Router();

/** Registers the shared-catalog tournament route modules. */
registerTournamentCoreRoutes(router);
registerTournamentTeamRoutes(router);
registerTournamentMatchRoutes(router);
registerTournamentStandingsAdvanceRoutes(router);

export default router;
