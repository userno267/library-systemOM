import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import socket from "../socket";

export default function UserChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId"); // your logged-in user ID
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  /* ===========================
     Load existing conversation
  =========================== */
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/support/my-conversation`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "anyvalue",
          },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data?.id) {
          setConversationId(data.id);
        }
      } catch (err) {
        console.error("❌ Load conversation error:", err);
      }
    };
    loadConversation();
  }, [baseUrl, token]);

  /* ===========================
     Fetch messages
  =========================== */
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);

    try {
      const res = await fetch(`${baseUrl}/api/support/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "anyvalue" },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);

      // Join socket room for live updates
      if (!socket.connected) socket.connect();
      socket.emit("joinConversation", conversationId);
    } catch (err) {
      console.error("❌ Fetch messages error:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, token, baseUrl]);

  /* ===========================
     Socket listener
  =========================== */
  useEffect(() => {
    const handleNewMessage = (data) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => [...prev, data]);
      }
    };
    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [conversationId]);

  /* ===========================
     Auto scroll
  =========================== */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ===========================
     Send message
  =========================== */
  const sendMessage = async () => {
    if (!input.trim()) return;

    try {
      const res = await fetch(`${baseUrl}/api/support/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "anyvalue",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, conversationId }),
      });
      const data = await res.json();

      // If conversation just created, join socket room
      if (!conversationId && data?.conversationId) {
        setConversationId(data.conversationId);
        socket.emit("joinConversation", data.conversationId);
      }

      setInput("");
    } catch (err) {
      console.error("❌ Send message error:", err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  /* ===========================
     Refetch messages when conversationId changes
  =========================== */
  useEffect(() => {
    fetchMessages();
  }, [conversationId, fetchMessages]);

  return (
    <>
      <Sidebar />
      <div className="main">
        <h1>💬 Support Chat</h1>

        <div className="chat-window">
          {loading && <p className="center">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="center">No messages yet. Start the conversation!</p>
          )}

          <div className="messages">
            {messages.map((msg, idx) => {
const isStudent = msg.sender === "student";
              return (
                <div className={`message ${isStudent ? "sender" : "receiver"}`}>
                  <div className="bubble">{msg.message}</div>
                  <div className="timestamp">{new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      </div>

      <BottomNav />

      <style jsx>{`
        .main {
          padding: 80px 16px 100px;
          background: #f9fbe7;
          min-height: 100vh;
          font-family: "Poppins", sans-serif;
          display: flex;
          flex-direction: column;
        }

        h1 {
          text-align: center;
          color: #2e7d32;
          margin-bottom: 15px;
        }

        .center {
          text-align: center;
          color: #777;
        }

        .chat-window {
          flex: 1;
          background: #fff8e1;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          margin-bottom: 10px;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .message {
          display: flex;
          flex-direction: column;
          max-width: 70%;
          word-wrap: break-word;
          padding: 8px 12px;
          border-radius: 12px;
        }

        .sender {
          align-self: flex-end;
          background: #c8e6c9;
          text-align: right;
        }

        .receiver {
          align-self: flex-start;
          background: #fff9c4;
          text-align: left;
        }

        .timestamp {
          font-size: 0.7rem;
          color: #555;
          margin-top: 2px;
        }

        .chat-input {
          display: flex;
          gap: 8px;
        }

        .chat-input input {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #8d6e63;
        }

        .chat-input button {
          padding: 10px 16px;
          border-radius: 8px;
          border: none;
          background: #2e7d32;
          color: #fff;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}