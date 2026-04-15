import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { exportPlayersToXlsx } from "../../../client/src/utils/playersExchange";

vi.mock("xlsx", () =>
{
  const utils = {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  };
  return {
    utils,
    write: vi.fn(() => new ArrayBuffer(8)),
    writeFile: vi.fn(),
  };
});

const rows = [{ firstName: "Anna", lastName: "Muster", className: "10a" }];

describe("playersExchange export", () =>
{
  afterEach(() =>
  {
    vi.restoreAllMocks();
  });

  it("uses download fallback when save picker is unavailable", async () =>
  {
    (globalThis as { window?: Window }).window = {} as Window;

    const result = await exportPlayersToXlsx(rows, "fallback.xlsx");

    expect(result).toBe("downloaded");
    expect(XLSX.writeFile).toHaveBeenCalledOnce();
  });

  it("returns saved when native save picker succeeds", async () =>
  {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }));
    (globalThis as { window?: Window & { showSaveFilePicker?: unknown } }).window = {
      showSaveFilePicker,
    } as Window & { showSaveFilePicker: typeof showSaveFilePicker };

    const result = await exportPlayersToXlsx(rows, "saved.xlsx");

    expect(result).toBe("saved");
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });

  it("returns cancelled when native save picker is aborted", async () =>
  {
    const showSaveFilePicker = vi.fn(async () =>
    {
      throw new DOMException("The user aborted a request.", "AbortError");
    });
    (globalThis as { window?: Window & { showSaveFilePicker?: unknown } }).window = {
      showSaveFilePicker,
    } as Window & { showSaveFilePicker: typeof showSaveFilePicker };

    const result = await exportPlayersToXlsx(rows, "cancelled.xlsx");

    expect(result).toBe("cancelled");
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });
});
