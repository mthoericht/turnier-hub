import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { exportPlayersToXlsx, parsePlayersImportFile } from "../../../client/src/utils/playersExchange";

function spreadsheet(rows: unknown[][]): File
{
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Spieler");
  return new File([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], "players.xlsx");
}

describe("real SheetJS import/export compatibility", () =>
{
  afterEach(() => vi.unstubAllGlobals());

  it("reads the existing sample and reports the existing empty-template error", async () =>
  {
    const sample = await readFile(new URL("../../../examples/players-import.xlsx", import.meta.url));
    const rows = await parsePlayersImportFile(new File([Uint8Array.from(sample).buffer], "players-import.xlsx"));
    expect(rows[0]).toEqual({ firstName: "Aylin", lastName: "Yilmaz", className: "10b" });
    const template = await readFile(new URL("../../../examples/players-import-template.xlsx", import.meta.url));
    await expect(parsePlayersImportFile(new File([Uint8Array.from(template).buffer], "template.xlsx")))
      .rejects.toThrow("Keine gültigen Zeilen gefunden. Bitte Werte prüfen.");
  });

  it("keeps header normalization, Unicode, incomplete-row handling and missing-column errors", async () =>
  {
    const rows = await parsePlayersImportFile(spreadsheet([
      [" vorNAME ", "NAME", "Klasse"],
      [" Änne ", " Müller ", " 10a "],
      ["Ben", "", "10b"],
    ]));
    expect(rows).toEqual([{ firstName: "Änne", lastName: "Müller", className: "10a" }]);
    await expect(parsePlayersImportFile(spreadsheet([["Vorname", "Andere"], ["Anna", "Muster"]])))
      .rejects.toThrow("Benötigte Spalten: Vorname, Name, Klasse.");
  });

  it("roundtrips native-export bytes with the existing German columns and all names intact", async () =>
  {
    let bytes: ArrayBuffer | undefined;
    vi.stubGlobal("window", {
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async (value: ArrayBuffer) => { bytes = value; },
          close: async () => {},
        }),
      }),
    });
    const rows = [{ firstName: "Änne", lastName: "Müller", className: "10a" }];
    expect(await exportPlayersToXlsx(rows, "Spieler.xlsx")).toBe("saved");
    expect(bytes).toBeDefined();
    const workbook = XLSX.read(bytes!, { type: "array" });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }))
      .toEqual([["Vorname", "Name", "Klasse"], ["Änne", "Müller", "10a"]]);
    expect(await parsePlayersImportFile(new File([bytes!], "roundtrip.xlsx"))).toEqual(rows);
  });
});
