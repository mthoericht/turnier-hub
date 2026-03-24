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
            class="min-w-0 truncate font-display text-base font-semibold tracking-tight text-court-800 dark:text-court-100 sm:text-lg"
          >
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
            <nav
              class="hidden items-center gap-1 text-sm md:flex md:gap-2 lg:gap-3"
              aria-label="Hauptnavigation"
            >
              <template v-if="auth.user">
                <RouterLink
                  class="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  to="/players"
                  active-class="!text-court-700 dark:!text-court-100"
                >
                  Spieler
                </RouterLink>
                <RouterLink
                  class="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  to="/classes"
                  active-class="!text-court-700 dark:!text-court-100"
                >
                  Klassen
                </RouterLink>
                <RouterLink
                  class="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  to="/tournaments"
                  active-class="!text-court-700 dark:!text-court-100"
                >
                  Turniere
                </RouterLink>
                <span class="hidden text-slate-300 lg:inline dark:text-slate-600"
                  >|</span
                >
                <span
                  class="hidden max-w-[10rem] truncate text-slate-600 dark:text-slate-500 lg:inline"
                  :title="auth.user.email"
                  >{{
                    auth.user.username
                      ? `@${auth.user.username}`
                      : auth.user.email
                  }}</span
                >
                <button
                  type="button"
                  class="rounded-lg px-3 py-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                  @click="auth.logout()"
                >
                  Abmelden
                </button>
              </template>
              <template v-else>
                <RouterLink :class="linkClass" to="/login"> Login </RouterLink>
                <RouterLink
                  class="rounded-lg bg-court-600 px-3 py-2 font-medium text-white transition hover:bg-court-600/90"
                  to="/signup"
                >
                  Registrieren
                </RouterLink>
              </template>
            </nav>
          </div>
        </div>
        <div
          v-show="navOpen"
          id="mobile-nav"
          class="border-t border-slate-200 pb-3 pt-2 dark:border-slate-800 md:hidden"
        >
          <nav class="flex flex-col gap-1" aria-label="Mobile Navigation">
            <template v-if="auth.user">
              <RouterLink
                :class="linkClass"
                to="/players"
                active-class="!text-court-700 dark:!text-court-100"
                >Spieler</RouterLink
              >
              <RouterLink
                :class="linkClass"
                to="/classes"
                active-class="!text-court-700 dark:!text-court-100"
                >Klassen</RouterLink
              >
              <RouterLink
                :class="linkClass"
                to="/tournaments"
                active-class="!text-court-700 dark:!text-court-100"
                >Turniere</RouterLink
              >
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
              <RouterLink :class="linkClass" to="/login">Login</RouterLink>
              <RouterLink
                class="rounded-lg bg-court-600 px-3 py-3 text-center text-base font-medium text-white hover:bg-court-600/90"
                to="/signup"
                >Registrieren</RouterLink
              >
            </template>
          </nav>
        </div>
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
