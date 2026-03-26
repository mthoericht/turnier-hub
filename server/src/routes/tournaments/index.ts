import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { registerTournamentCoreRoutes } from "./core.js";
import { registerTournamentTeamRoutes } from "./teams.js";
import { registerTournamentMatchRoutes } from "./matches.js";
import { registerTournamentStandingsAdvanceRoutes } from "./standings-advance.js";

const router = Router();
router.use(authMiddleware);

registerTournamentCoreRoutes(router);
registerTournamentTeamRoutes(router);
registerTournamentMatchRoutes(router);
registerTournamentStandingsAdvanceRoutes(router);

export default router;
