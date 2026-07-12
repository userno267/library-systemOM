import { createContext, useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import socket from "../socket";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, token } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const baseURL = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  // fetch initial count
  useEffect(() => {
    if (!user || !token) return;

    const fetchUnread = async () => {
      try {
        const res = await fetch(`${baseURL}/api/notifications/unread-count`, {
          headers: {
            "ngrok-skip-browser-warning": "true",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (typeof data.count === "number") {
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    fetchUnread();
  }, [user?.id, token]);

  // socket — increment on new notification
  useEffect(() => {
    if (!user?.id || !token) return;

    const handleNewNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("newNotification", handleNewNotification);
    return () => socket.off("newNotification", handleNewNotification);
  }, [user?.id, token]);

  // called by NotificationsPage when a notification is read
  const decrementUnread = (amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  };

  // called when Mark All as Read is clicked
  const clearUnread = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ unreadCount, decrementUnread, clearUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};