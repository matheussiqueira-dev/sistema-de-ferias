import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// A sessão vive em cookie HttpOnly: toda chamada precisa enviar credenciais.
export const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== "undefined") {
    window.location.assign("/login");
  }
  return Promise.reject(error);
});
