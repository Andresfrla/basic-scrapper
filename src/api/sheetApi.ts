import axios from "axios";
import type { SheetRow } from "../types/sheet";

const BASE_URL = "/api/sheet";

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "error" in data) {
      return String((data as { error: unknown }).error);
    }
    if (error.request && !error.response) {
      return "No se pudo conectar al servidor. ¿Está ejecutando npm run dev?";
    }
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function listRows(): Promise<SheetRow[]> {
  try {
    const response = await axios.get<SheetRow[]>(`${BASE_URL}/rows`);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function createRow(): Promise<SheetRow> {
  try {
    const response = await axios.post<SheetRow>(`${BASE_URL}/rows`, {});
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function updateRow(
  id: string,
  patch: { values?: Record<string, string>; addedFromScrape?: boolean }
): Promise<SheetRow> {
  try {
    const response = await axios.patch<SheetRow>(`${BASE_URL}/rows/${id}`, patch);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function deleteRow(id: string): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/rows/${id}`);
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export interface ScrapeAllSummary {
  processed: number;
  scraped: number;
  skipped: number;
  errors: Array<{ pedimento: string; message: string }>;
  updatedRows: SheetRow[];
  createdRows: SheetRow[];
}

export async function scrapeAll(): Promise<ScrapeAllSummary> {
  try {
    const response = await axios.post<ScrapeAllSummary>(`${BASE_URL}/scrape-all`, {});
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}
