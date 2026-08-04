import axios from "axios";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

const BASE_URL = "/api/notifications";

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

export async function listContacts(): Promise<NotificationContact[]> {
  try {
    const response = await axios.get<NotificationContact[]>(`${BASE_URL}/contacts`);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function createContact(input: NotificationContactInput): Promise<NotificationContact> {
  try {
    const response = await axios.post<NotificationContact>(`${BASE_URL}/contacts`, input);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function updateContact(
  id: string,
  patch: Partial<NotificationContactInput>
): Promise<NotificationContact> {
  try {
    const response = await axios.patch<NotificationContact>(`${BASE_URL}/contacts/${id}`, patch);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function deleteContact(id: string): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/contacts/${id}`);
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}
