import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useThemeStore } from "./stores/theme";
import "./style.css";

const pinia = createPinia();
setActivePinia(pinia);
useThemeStore().init();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount("#app");
