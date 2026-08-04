import axios from "axios";

export async function login(password: string): Promise<void> {
  await axios.post("/api/auth/login", { password });
}

export async function getSession(): Promise<boolean> {
  const { data } = await axios.get<{ authenticated: boolean }>("/api/auth/session");
  return data.authenticated;
}

export async function logout(): Promise<void> {
  await axios.post("/api/auth/logout");
}
