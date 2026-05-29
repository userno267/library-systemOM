import { io } from "socket.io-client";

const socket = io("https://unprogressively-noncognitive-karis.ngrok-free.dev", {
  transports: ["websocket", "polling"],
  query: { skipBrowserWarning: "true" },
  autoConnect: false,
});

export default socket;