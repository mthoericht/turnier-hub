import { defineStore } from "pinia";
import { ref, computed } from "vue";

const STORAGE_KEY = "turnier_hub_theme";

function applyDarkClass(dark: boolean): void 
{
  document.documentElement.classList.toggle("dark", dark);
}

export const useThemeStore = defineStore("theme", () => 
{
  const mode = ref<"light" | "dark">("dark");

  function init(): void 
  {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") 
    {
      mode.value = saved;
    }
    else 
    {
      mode.value = "dark";
    }
    applyDarkClass(mode.value === "dark");
  }

  function setLight(): void 
  {
    mode.value = "light";
    localStorage.setItem(STORAGE_KEY, "light");
    applyDarkClass(false);
  }

  function setDark(): void 
  {
    mode.value = "dark";
    localStorage.setItem(STORAGE_KEY, "dark");
    applyDarkClass(true);
  }

  function toggle(): void 
  {
    if (mode.value === "dark") setLight();
    else setDark();
  }

  const isDark = computed(() => mode.value === "dark");

  return { mode, isDark, init, toggle, setLight, setDark };
});
