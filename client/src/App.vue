<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import ToastHost from "./components/ToastHost.vue";
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
            <svg
              class="h-6 w-6 text-blue-600 dark:text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
              <path d="M7 6H4a2 2 0 0 0 2 2h1" />
              <path d="M17 6h3a2 2 0 0 1-2 2h-1" />
            </svg>
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
              <svg
                v-if="theme.isDark"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
              :aria-expanded="navOpen"
              aria-controls="mobile-nav"
              aria-label="Menü"
              @click="navOpen = !navOpen"
            >
              <svg
                v-if="!navOpen"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
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
            <RouterLink :to="'/'" :class="navLinkClass('/')">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
              </svg>
              Dashboard
            </RouterLink>
            <RouterLink :to="'/classes'" :class="navLinkClass('/classes')">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 10h18" />
                <path d="M5 10V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
                <path d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
              </svg>
              Klassen
            </RouterLink>
            <RouterLink :to="'/players'" :class="navLinkClass('/players')">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Spieler
            </RouterLink>
            <RouterLink
              :to="'/tournaments'"
              :class="navLinkClass('/tournaments')"
            >
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Turniere
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
            <RouterLink :to="'/'" :class="linkClass" @click="navOpen = false">
              Dashboard
            </RouterLink>
            <RouterLink
              :to="'/classes'"
              :class="linkClass"
              @click="navOpen = false"
            >
              Klassen
            </RouterLink>
            <RouterLink
              :to="'/players'"
              :class="linkClass"
              @click="navOpen = false"
            >
              Spieler
            </RouterLink>
            <RouterLink
              :to="'/tournaments'"
              :class="linkClass"
              @click="navOpen = false"
            >
              Turniere
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
