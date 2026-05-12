<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, ref, watch, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import ToastHost from "./components/ToastHost.vue";
import AppIcon from "./components/common/AppIcon.vue";
import EntityDialog from "./components/common/EntityDialog.vue";
import GlobalTextPromptDialog from "./components/common/GlobalTextPromptDialog.vue";
import { useAuthStore } from "./stores/auth";
import { useConfirmDialogStore } from "./stores/confirmDialog";

const auth = useAuthStore();
const confirmDialog = useConfirmDialogStore();
const { open: confirmOpen, title: confirmTitle, description: confirmDescription, submitLabel: confirmSubmitLabel } =
  storeToRefs(confirmDialog);
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
  "rounded-lg px-3 py-3 text-base text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:py-2 md:text-sm";

type MainNavItem = {
  to: string;
  label: string;
  icon: "trophy" | "classes" | "players" | "calendar" | "admin";
};

const mainNavItems = computed<MainNavItem[]>(() =>
{
  const baseItems: MainNavItem[] = [
    { to: "/", label: "Dashboard", icon: "trophy" },
    { to: "/classes", label: "Klassen", icon: "classes" },
    { to: "/players", label: "Spieler", icon: "players" },
    { to: "/tournaments", label: "Turniere", icon: "calendar" },
  ];
  if (auth.user?.role === "admin")
  {
    baseItems.push({ to: "/admin", label: "Admin", icon: "admin" });
  }
  return baseItems;
});

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
      ? "border-blue-600 text-blue-600"
      : "border-transparent text-slate-600 hover:text-slate-900",
  ].join(" ");
}
</script>

<template>
  <div class="flex min-h-screen min-h-[100dvh] flex-col">
    <a
      href="#main-content"
      class="fixed left-4 top-4 z-[100] -translate-y-[200%] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      Zum Inhalt springen
    </a>
    <header
      class="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur"
    >
      <div class="mx-auto max-w-5xl px-3 sm:px-4">
        <div class="flex items-center justify-between gap-2 py-3">
          <RouterLink
            to="/"
            class="flex min-w-0 items-center gap-2 truncate font-display text-base font-semibold tracking-tight text-slate-900 sm:text-lg"
          >
            <AppIcon name="trophy" class="h-6 w-6 text-blue-600" />
            Turnier-Hub
          </RouterLink>
          <div class="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-100 md:hidden"
              :aria-expanded="navOpen"
              aria-controls="mobile-nav"
              aria-label="Menü"
              @click="navOpen = !navOpen"
            >
              <AppIcon v-if="!navOpen" name="menu" class="h-5 w-5" />
              <AppIcon v-else name="close" class="h-5 w-5" />
            </button>
            <div class="hidden items-center gap-2 md:flex">
              <template v-if="auth.ready && auth.user">
                <div class="max-w-[20rem] text-right leading-tight">
                  <p
                    class="truncate font-mono text-sm text-slate-700"
                    :title="auth.user.subject"
                  >
                    {{ auth.user.subject }}
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded-lg border border-rose-200 bg-white/60 px-3 py-2 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                  @click="auth.logout()"
                >
                  Abmelden
                </button>
              </template>
              <p
                v-else-if="auth.ready"
                class="max-w-xs text-right text-xs text-amber-800"
              >
                Keine Sitzung: Reverse-Proxy muss <span class="font-mono">Remote-User</span> setzen (Authelia), oder in der Entwicklung <span class="font-mono">DEV_REMOTE_USER</span> in der Server-<span class="font-mono">.env</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="auth.ready && auth.user"
        class="hidden border-b border-slate-200 bg-white/70 backdrop-blur md:block"
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
              :aria-current="isNavActive(item.to) ? 'page' : undefined"
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
        class="border-t border-slate-200 pb-3 pt-2 md:hidden"
      >
        <nav class="flex flex-col gap-1 px-3" aria-label="Mobile Navigation">
          <template v-if="auth.ready && auth.user">
            <RouterLink
              v-for="item in mainNavItems"
              :key="item.to"
              :to="item.to"
              :class="linkClass"
              :aria-current="isNavActive(item.to) ? 'page' : undefined"
              @click="navOpen = false"
            >
              {{ item.label }}
            </RouterLink>
            <p
              class="truncate px-3 py-2 font-mono text-sm text-slate-600"
              :title="auth.user.subject"
            >
              {{ auth.user.subject }}
            </p>
            <button
              type="button"
              class="rounded-lg px-3 py-3 text-left text-base text-rose-600 hover:bg-rose-50"
              @click="auth.logout()"
            >
              Abmelden
            </button>
          </template>
          <p
            v-else-if="auth.ready"
            class="px-3 py-2 text-sm text-amber-800"
          >
            Keine Sitzung (siehe Desktop-Hinweis zu Remote-User / Authelia).
          </p>
        </nav>
      </div>
    </header>
    <main
      id="main-content"
      tabindex="-1"
      class="mx-auto w-full max-w-5xl flex-1 px-3 py-6 outline-none sm:px-4 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
    >
      <RouterView />
    </main>
    <ToastHost />
    <EntityDialog
      :open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :submit-label="confirmSubmitLabel"
      @close="confirmDialog.close"
      @submit="confirmDialog.submit"
    />
    <GlobalTextPromptDialog />
  </div>
</template>
