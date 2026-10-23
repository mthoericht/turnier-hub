const result = document.getElementById("result");
const buttons = [...document.querySelectorAll("button[data-action]")];

async function refresh()
{
  const info = await window.turnierHost.info();
  const list = document.getElementById("host-info");
  list.replaceChildren();
  for (const [label, value] of [
    ["Verbindungsadresse für weitere Geräte", info.lanUrls.join("\n") || "Kein Netzwerk gefunden. WLAN verbinden und die App neu starten."],
    ["Lokale Adresse", info.localUrl], ["Port", String(info.port)],
    ["App-Version", info.version], ["Datenordner", info.dataDir],
  ])
  {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    list.append(term, description);
  }
  document.getElementById("counts").textContent = info.counts
    ? `${info.counts.classes} Klassen · ${info.counts.players} Spieler · ${info.counts.tournaments} Turniere` : "Datenaktion läuft …";
}

for (const button of buttons)
{
  button.addEventListener("click", async () =>
  {
    buttons.forEach((entry) => { entry.disabled = true; });
    result.className = "";
    result.textContent = "Bitte warten …";
    try
    {
      const response = await window.turnierHost.run(button.dataset.action);
      result.textContent = response.error || response.message;
      result.className = response.error ? "error" : "";
      result.setAttribute("role", response.error ? "alert" : "status");
      await refresh();
    }
    catch { result.textContent = "Die Host-Verwaltung ist momentan nicht erreichbar. Bitte die App prüfen."; }
    finally { buttons.forEach((entry) => { entry.disabled = false; }); }
  });
}
refresh().catch(() => { result.textContent = "Host-Informationen konnten nicht geladen werden."; });
