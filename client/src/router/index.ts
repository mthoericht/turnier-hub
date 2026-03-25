import { createRouter, createWebHistory } from "vue-router";
import { getToken } from "@/api/http";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { guest: true },
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("@/views/SignupView.vue"),
      meta: { guest: true },
    },
    {
      path: "/players",
      name: "players",
      component: () => import("@/views/PlayersViewPreset.vue"),
      meta: { auth: true },
    },
    {
      path: "/classes",
      name: "classes",
      component: () => import("@/views/ClassesViewPreset.vue"),
      meta: { auth: true },
    },
    {
      path: "/tournaments",
      name: "tournaments",
      component: () => import("@/views/TournamentsView.vue"),
      meta: { auth: true },
    },
    {
      path: "/tournaments/:id",
      component: () => import("@/views/tournament/TournamentLayout.vue"),
      meta: { auth: true },
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

router.beforeEach((to) => 
{
  if (to.meta.auth && !getToken()) 
  {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.guest && getToken()) 
  {
    return { name: "home" };
  }
  return true;
});

export default router;
