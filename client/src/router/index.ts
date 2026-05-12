import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: () => import("@/views/DashboardView.vue"),
    },
    {
      path: "/players",
      name: "players",
      component: () => import("@/views/PlayersViewPreset.vue"),
    },
    {
      path: "/classes",
      name: "classes",
      component: () => import("@/views/ClassesViewPreset.vue"),
    },
    {
      path: "/tournaments",
      name: "tournaments",
      component: () => import("@/views/TournamentsView.vue"),
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/views/AdminView.vue"),
    },
    {
      path: "/tournaments/:id",
      component: () => import("@/views/tournament/TournamentLayout.vue"),
      children: [
        {
          path: "",
          name: "tournament-detail",
          redirect: { name: "tournament-roster" },
        },
        {
          path: "matches",
          component: () =>
            import("@/views/tournament/TournamentMatchesLayout.vue"),
          redirect: (to) => ({
            name: "tournament-matches-overview",
            params: { id: to.params.id as string },
          }),
          children: [
            {
              path: "",
              name: "tournament-matches-overview",
              component: () =>
                import("@/views/tournament/TournamentMatchesOverviewView.vue"),
            },
            {
              path: "setup",
              name: "tournament-matches-setup",
              component: () =>
                import("@/views/tournament/TournamentMatchesSetupView.vue"),
            },
          ],
        },
        {
          path: "roster",
          name: "tournament-roster",
          component: () =>
            import("@/views/tournament/TournamentRosterView.vue"),
        },
      ],
    },
  ],
});

export default router;
