/**
 * Hostinger VPS Server: http://76.13.246.224:4000
 * Directly connected to Hostinger VPS backend server for both Development & Production.
 */
export const LIVE_VPS_URL = "http://76.13.246.224:4000";

export function getApiBaseUrl() {
  // Directly and unconditionally connect to Hostinger VPS
  const url = process.env.EXPO_PUBLIC_API_URL || LIVE_VPS_URL;
  return (url && typeof url === "string" ? url.trim().replace(/\/$/, "") : LIVE_VPS_URL);
}

export const API_PREFIX = "/api";
