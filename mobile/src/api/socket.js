import { io } from "socket.io-client";
import { getApiBaseUrl } from "../config";

let socket;

export const getSocket = () => {
  if (!socket) {
    const baseURL = getApiBaseUrl();
    socket = io(baseURL, {
      transports: ["websocket"],
      autoConnect: true,
      extraHeaders: {
        "Bypass-Tunnel-Reminder": "true"
      }
    });
  }
  return socket;
};
