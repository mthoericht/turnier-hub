import * as XLSX from "xlsx";

/**
 * Normalized player row used by the XLSX import parser.
 * Matches the expected spreadsheet columns:
 * `Vorname`, `Name`, `Klasse`.
 */
export type ImportPlayerRow = {
  firstName: string;
  lastName: string;
  className: string;
};

/** Export row shape is identical to the import row shape. */
export type ExportPlayerRow = ImportPlayerRow;

/**
 * Result of an export attempt:
 * - `saved`: user picked a location via File System Access API.
 * - `downloaded`: fallback browser download was triggered.
 * - `cancelled`: user aborted the native save dialog.
 */
export type ExportResult = "saved" | "downloaded" | "cancelled";

/**
 * Normalizes raw header cell values for robust matching.
 * Trims whitespace and lowercases the content.
 */
function normalizeHeader(value: unknown): string
{
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Parses an XLS/XLSX file and returns normalized player rows.
 *
 * Required header columns (first row):
 * - `Vorname`
 * - `Name`
 * - `Klasse`
 *
 * Rows missing one of the required values are discarded.
 * Throws a user-friendly error if the sheet is empty, has missing headers,
 * or contains no valid data rows.
 */
export async function parsePlayersImportFile(file: File): Promise<ImportPlayerRow[]>
{
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Die Datei enthält kein Tabellenblatt.");

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (rows.length === 0) throw new Error("Die Datei enthält keine Daten.");

  const [headerRow, ...dataRows] = rows;
  const headerMap = new Map(
    (headerRow ?? []).map((cell, index) => [normalizeHeader(cell), index] as const),
  );

  const firstNameIndex = headerMap.get("vorname");
  const lastNameIndex = headerMap.get("name");
  const classIndex = headerMap.get("klasse");
  if (firstNameIndex == null || lastNameIndex == null || classIndex == null)
  {
    throw new Error("Benötigte Spalten: Vorname, Name, Klasse.");
  }

  const parsed = dataRows
    .map((row) =>
    {
      const columns = Array.isArray(row) ? row : [];
      return {
        firstName: String(columns[firstNameIndex] ?? "").trim(),
        lastName: String(columns[lastNameIndex] ?? "").trim(),
        className: String(columns[classIndex] ?? "").trim(),
      };
    })
    .filter((row) => row.firstName && row.lastName && row.className);

  if (parsed.length === 0)
  {
    throw new Error("Keine gültigen Zeilen gefunden. Bitte Werte prüfen.");
  }
  return parsed;
}

/**
 * Exports player rows to an XLSX workbook with columns:
 * `Vorname`, `Name`, `Klasse`.
 *
 * Behavior:
 * 1. Tries to open a native "Save As" picker via `showSaveFilePicker`
 *    (when supported by the browser).
 * 2. Falls back to standard browser download (`XLSX.writeFile`) otherwise.
 *
 * @param rows - Player rows to export.
 * @param fileName - Suggested output filename (defaults to `players-export.xlsx`).
 * @returns Export outcome used by UI feedback.
 */
export async function exportPlayersToXlsx(rows: ExportPlayerRow[], fileName = "players-export.xlsx"): Promise<ExportResult>
{
  const sheetRows = rows.map((row) => ({
    Vorname: row.firstName,
    Name: row.lastName,
    Klasse: row.className,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows, {
    header: ["Vorname", "Name", "Klasse"],
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Spieler");
  
  const pickerWindow = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: ArrayBuffer) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof pickerWindow.showSaveFilePicker === "function")
  {
    try
    {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Excel Arbeitsmappe",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      const workbookBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      await writable.write(workbookBytes);
      await writable.close();
      return "saved";
    }
    catch (error)
    {
      if (error instanceof DOMException && error.name === "AbortError")
      {
        return "cancelled";
      }
    }
  }

  XLSX.writeFile(wb, fileName);
  return "downloaded";
}
