const parameters = new URLSearchParams(window.location.search);
const status = parameters.get("status") || "starting";
const ready = status === "ready";
document.title = `Turnier-Hub ${parameters.get("version") || ""} · ${parameters.get("development") === "1" ? "Entwicklung" : "Host"}`;
document.body.dataset.status = status;
const manage = document.getElementById("manage");
manage.hidden = !ready;
manage.addEventListener("click", () => window.turnierHost.open());
const state = document.getElementById("startup-state");
state.hidden = ready;
state.setAttribute("role", status === "error" ? "alert" : "status");
document.getElementById("state-title").textContent = { starting: "Einen Moment bitte", stopping: "Netzwerkbetrieb wird beendet", maintenance: "Datenaktion läuft", error: "Die App konnte nicht starten" }[status] || "";
document.getElementById("state-detail").textContent = parameters.get("detail")
  || (status === "maintenance" ? "Der Netzwerkbetrieb pausiert kurz. Bitte die Host-Verwaltung geöffnet lassen. Danach verbinden sich die Geräte automatisch neu."
    : status === "stopping" ? "Server und Verbindungen werden geschlossen." : "Lokale Datenbank und Server werden vorbereitet. Die Oberfläche öffnet sich automatisch.");
