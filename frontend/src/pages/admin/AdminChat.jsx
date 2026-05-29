// /src/pages/admin/AdminChat.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import socket from "../../socket";

export default function AdminChat() {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesContainerRef = useRef(null);
  const isUserNearBottom = useRef(true);

  const token = localStorage.getItem("token");
  const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  // ===========================
  // DEBUG HELPER
  // ===========================
  const debugScroll = (label) => {
    const el = messagesContainerRef.current;
    if (!el) {
      console.log(`[${label}] ❌ no element`);
      return;
    }

    console.log(`[${label}]`, {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      distanceFromBottom:
        el.scrollHeight - el.scrollTop - el.clientHeight,
    });
  };

  // ===========================
  // Fetch Conversations
  // ===========================
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/support/admin/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "anyvalue",
        },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setConversations(list);
      setFilteredConversations(
        list.filter((conv) =>
          `${conv.user_name} ${conv.lrn || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      );
    } catch (err) {
      console.error("❌ Fetch conversations error:", err);
    }
  }, [baseUrl, token, search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ===========================
  // Fetch Messages
  // ===========================
  const fetchMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;

      console.log("📥 Fetching messages:", conversationId);
      setLoadingMessages(true);

      try {
        const res = await fetch(`${baseUrl}/api/support/${conversationId}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "anyvalue",
          },
        });

        const data = await res.json();
        console.log("✅ Messages loaded:", data?.length);

        setMessages(Array.isArray(data) ? data : []);

        await fetch(`${baseUrl}/api/support/${conversationId}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });

        fetchConversations();
      } catch (err) {
        console.error("❌ Fetch messages error:", err);
      } finally {
        setLoadingMessages(false);
        console.log("🏁 Finished loading messages");
      }
    },
    [baseUrl, token, fetchConversations]
  );

  // ===========================
  // Socket
  // ===========================
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleNewMessage = (data) => {
      const { conversationId } = data;

      console.log("📨 New message socket:", data);

      setMessages((prev) => {
        if (activeConversation?.id === conversationId) {
          return [...prev, data];
        }
        return prev;
      });

      fetchConversations();
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [activeConversation, fetchConversations]);

  // ===========================
  // Open conversation
  // ===========================
  const openConversation = (conv) => {
    const conversationId = conv.conversation_id || null;

    console.log("🟢 Open conversation:", conversationId);

    setActiveConversation({ ...conv, id: conversationId });
    setMessages([]);

    if (conversationId) {
      fetchMessages(conversationId);
      socket.emit("joinConversation", `${conversationId}`);
    }
  };

  // ===========================
  // Send message
  // ===========================
  const sendMessage = async () => {
    if (!input.trim() || !activeConversation) return;

    try {
      const body = { message: input };
      if (!activeConversation.id && activeConversation.user_id) {
        body.studentId = activeConversation.user_id;
      } else {
        body.conversationId = activeConversation.id;
      }

      const res = await fetch(`${baseUrl}/api/support/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "anyvalue",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setInput("");

      if (!activeConversation.id && data?.conversationId) {
        const newId = data.conversationId;
        setActiveConversation({ ...activeConversation, id: newId });
        socket.emit("joinConversation", `${newId}`);
        fetchMessages(newId);
      }
    } catch (err) {
      console.error("❌ Send message error:", err);
    }
  };

  // ===========================
  // Detect user scroll
  // ===========================
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distance =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    isUserNearBottom.current = distance < 100;

    console.log("🖱️ Scroll:", {
      distance,
      nearBottom: isUserNearBottom.current,
    });
  };

  // ===========================
  // Scroll AFTER load
  // ===========================
  useEffect(() => {
    if (loadingMessages) return;

    const el = messagesContainerRef.current;
    if (!el) return;

    console.log("🚀 Scroll after load triggered");
    debugScroll("BEFORE LOAD");

    setTimeout(() => {
      el.scrollTop = el.scrollHeight;

      console.log("✅ Scrolled to bottom after load");
      debugScroll("AFTER LOAD");
    }, 200); // increased delay
  }, [loadingMessages]);

  // ===========================
  // Scroll on new messages
  // ===========================
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    console.log("💬 Messages changed:", messages.length);

    if (!isUserNearBottom.current) {
      console.log("⛔ Skip scroll (user not at bottom)");
      return;
    }

    console.log("⬇️ Smooth scroll");
    debugScroll("BEFORE SMOOTH");

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });

    setTimeout(() => {
      debugScroll("AFTER SMOOTH");
    }, 200);
  }, [messages]);

  return (
    <>
      <AdminSidebar />
      <div className="chat-container">
        <div className="conversation-list">
          <h2>Support Chats</h2>
          <input
            type="text"
            placeholder="Search by name or LRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />

          {filteredConversations.map((conv) => (
            <div
              key={conv.user_id}
              className={`conversation-item ${
                activeConversation?.id === conv.conversation_id ? "active" : ""
              }`}
              onClick={() => openConversation(conv)}
            >
              <div className="top-row">
                <strong>{conv.user_name}</strong>
                <span>
                  {conv.last_message_at &&
                    new Date(conv.last_message_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="preview">{conv.last_message || "No messages"}</p>
              {conv.unread_count > 0 && (
                <span className="badge">{conv.unread_count}</span>
              )}
            </div>
          ))}
        </div>

        <div className="chat-panel">
          {!activeConversation ? (
            <div className="empty-chat">
              Select a conversation to start chatting
            </div>
          ) : (
            <>
              <div className="chat-header">
                <h3>{activeConversation.user_name}</h3>
              </div>

              <div
                className="messages"
                ref={messagesContainerRef}
                onScroll={handleScroll}
              >
                {loadingMessages ? (
                  <p className="center">Loading messages...</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`message ${
                        msg.sender === "admin" ? "admin" : "user"
                      }`}
                    >
                      <div className="bubble">{msg.message}</div>
                      <span className="time">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="input-area">
                <input
                  type="text"
                  placeholder="Type message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>

      <style >{`
        .chat-container {
          margin-left: 260px;
          display: flex;
          height: 100vh;
          background: #f9fbe7;
        }
        .conversation-list {
          width: 320px;
          background: white;
          border-right: 1px solid #ddd;
          overflow-y: auto;
          padding: 20px;
        }
        .search-input {
          width: 100%;
          padding: 8px;
          margin-bottom: 15px;
          border-radius: 8px;
          border: 1px solid #ccc;
        }
        .conversation-item {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 10px;
          cursor: pointer;
          position: relative;
          background: #f1f8e9;
        }
        .conversation-item.active {
          background: #c8e6c9;
        }
        .top-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        .preview {
          font-size: 0.85rem;
          color: #555;
        }
        .badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #e53935;
          color: white;
          font-size: 0.75rem;
          padding: 3px 7px;
          border-radius: 50%;
        }
        .chat-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .chat-header {
          padding: 15px;
          background: #c5e1a5;
          font-weight: bold;
        }
        .messages {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
        }
        .message {
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
        }
        .message.admin {
          align-items: flex-end;
        }
        .bubble {
          padding: 8px 12px;
          border-radius: 12px;
          max-width: 70%;
          background: #fff9c4;
        }
        .message.admin .bubble {
          background: #c8e6c9;
        }
        .time {
          font-size: 0.7rem;
          color: #777;
        }
        .input-area {
          display: flex;
          padding: 10px;
          border-top: 1px solid #ddd;
        }
        .input-area input {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #ccc;
        }
        .input-area button {
          margin-left: 10px;
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: white;
          font-weight: bold;
        }
        .center,
        .empty-chat {
          text-align: center;
          color: #777;
          margin-top: 40px;
        }
      `}</style>
    </>
  );
}