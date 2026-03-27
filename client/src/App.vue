<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import ToastHost from "./components/ToastHost.vue";
import AppIcon from "./components/common/AppIcon.vue";
import { useAuthStore } from "./stores/auth";
import { useThemeStore } from "./stores/theme";

const auth = useAuthStore();
const theme = useThemeStore();
const route = useRoute();
const navOpen = ref(false);

onMounted(() => 
{
  void auth.hydrate();
});

watch(
  () => route.fullPath,
  () => 
  {
    navOpen.value = false;
  }
);

const linkClass =
  "rounded-lg px-3 py-3 text-base text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white md:py-2 md:text-sm";

type MainNavItem = {
  to: string;
  label: string;
  icon: "trophy" | "classes" | "players" | "calendar";
};

const mainNavItems: MainNavItem[] = [
  { to: "/", label: "Dashboard", icon: "trophy" },
  { to: "/classes", label: "Klassen", icon: "classes" },
  { to: "/players", label: "Spieler", icon: "players" },
  { to: "/tournaments", label: "Turniere", icon: "calendar" },
];

function isNavActive(prefix: string): boolean 
{
  if (prefix === "/") return route.path === "/";
  return route.path.startsWith(prefix);
}

function navLinkClass(prefix: string): string 
{
  const active = isNavActive(prefix);
  return [
    "flex items-center gap-2 py-4 border-b-2 transition-colors",
    active
      ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
      : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
  ].join(" ");
}
</script>

<template>
  <div class="flex min-h-screen min-h-[100dvh] flex-col">
    <header
      class="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div class="mx-auto max-w-5xl px-3 sm:px-4">
        <div class="flex items-center justify-between gap-2 py-3">
          <RouterLink
            to="/"
            class="flex min-w-0 items-center gap-2 truncate font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg"
          >
            <AppIcon name="trophy" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Turnier-Hub
          </RouterLink>
          <div class="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 md:p-2"
              :title="theme.isDark ? 'Hellmodus' : 'Dunkelmodus'"
              :aria-label="
                theme.isDark ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'
              "
              @click="theme.toggle()"
            >
              <AppIcon v-if="theme.isDark" name="sun" class="h-5 w-5" />
              <AppIcon v-else name="moon" class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
              :aria-expanded="navOpen"
              aria-controls="mobile-nav"
              aria-label="Menü"
              @click="navOpen = !navOpen"
            >
              <AppIcon v-if="!navOpen" name="menu" class="h-5 w-5" />
              <AppIcon v-else name="close" class="h-5 w-5" />
            </button>
            <div class="hidden items-center gap-2 md:flex">
              <template v-if="auth.user">
                <span
                  class="max-w-[10rem] truncate text-slate-600 dark:text-slate-500"
                  :title="auth.user.email"
                >
                  {{
                    auth.user.username
                      ? `@${auth.user.username}`
                      : auth.user.email
                  }}
                </span>
                <button
                  type="button"
                  class="rounded-lg border border-rose-200 bg-white/60 px-3 py-2 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:border-rose-700/60 dark:hover:bg-rose-950/40"
                  @click="auth.logout()"
                >
                  Abmelden
                </button>
              </template>
              <template v-else>
                <RouterLink :class="linkClass" to="/login"> Login </RouterLink>
                <RouterLink
                  class="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-600/90"
                  to="/signup"
                >
                  Registrieren
                </RouterLink>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="auth.user"
        class="hidden border-b border-slate-200 bg-white/70 backdrop-blur md:block dark:border-slate-800 dark:bg-slate-900/60"
      >
        <div class="mx-auto max-w-5xl px-3 sm:px-4">
          <nav
            class="flex w-full items-center justify-center gap-8"
            aria-label="Hauptnavigation"
          >
            <RouterLink
              v-for="item in mainNavItems"
              :key="item.to"
              :to="item.to"
              :class="navLinkClass(item.to)"
            >
              <AppIcon :name="item.icon" class="h-5 w-5" />
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>
      </div>

      <div
        v-show="navOpen"
        id="mobile-nav"
        class="border-t border-slate-200 pb-3 pt-2 dark:border-slate-800 dark:bg-slate-900/60 md:hidden"
      >
        <nav class="flex flex-col gap-1 px-3" aria-label="Mobile Navigation">
          <template v-if="auth.user">
            <RouterLink
              v-for="item in mainNavItems"
              :key="item.to"
              :to="item.to"
              :class="linkClass"
              @click="navOpen = false"
            >
              {{ item.label }}
            </RouterLink>
            <p
              class="truncate px-3 py-2 text-sm text-slate-500 dark:text-slate-400"
              :title="auth.user.email"
            >
              {{
                auth.user.username
                  ? `@${auth.user.username}`
                  : auth.user.email
              }}
            </p>
            <button
              type="button"
              class="rounded-lg px-3 py-3 text-left text-base text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
              @click="auth.logout()"
            >
              Abmelden
            </button>
          </template>
          <template v-else>
            <RouterLink :class="linkClass" to="/login" @click="navOpen = false">
              Login
            </RouterLink>
            <RouterLink
              class="rounded-lg bg-blue-600 px-3 py-3 text-center text-base font-medium text-white hover:bg-blue-600/90"
              to="/signup"
              @click="navOpen = false"
            >
              Registrieren
            </RouterLink>
          </template>
        </nav>
      </div>
    </header>
    <main
      class="mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-4 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
    >
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
