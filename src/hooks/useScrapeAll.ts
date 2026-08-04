import { scrapeAll as scrapeAllRequest } from "../api/sheetApi";
import { useSheetStore } from "../store/useSheetStore";

export function useScrapeAll() {
  const applyRows = useSheetStore((state) => state.applyRows);

  async function scrapeAll() {
    const summary = await scrapeAllRequest();
    applyRows([...summary.updatedRows, ...summary.createdRows]);
    return summary;
  }

  return { scrapeAll };
}
