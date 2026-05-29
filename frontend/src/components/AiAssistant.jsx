import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function AiAssistant({ apiUrl, token }) {
  const BUBBLE_SIZE = 70;
  const MARGIN = 20;

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });

  const [messages, setMessages] = useState([
    { role: "ai", text: "Hello! I can help you find books and library info." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bubbleRef = useRef(null);
  const chatBodyRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0, time: 0 });

  /* ================= INIT POSITION (RIGHT SIDE) ================= */
  useEffect(() => {
    setPosition({
      x: window.innerWidth - BUBBLE_SIZE - MARGIN,
      y: 120,
    });
  }, []);

  /* ================= DRAG ================= */
  const startDrag = (clientX, clientY) => {
    setDragging(true);
    setOffset({ x: clientX - position.x, y: clientY - position.y });
    lastPos.current = { x: clientX, y: clientY, time: Date.now() };
  };

  const moveDrag = (clientX, clientY) => {
    if (!dragging) return;

    const newX = Math.min(
      Math.max(clientX - offset.x, 0),
      window.innerWidth - BUBBLE_SIZE
    );

    const newY = Math.min(
      Math.max(clientY - offset.y, 0),
      window.innerHeight - BUBBLE_SIZE
    );

    const now = Date.now();
    const dt = Math.max(now - lastPos.current.time, 1);

    setVelocity({
      x: (clientX - lastPos.current.x) / dt,
      y: (clientY - lastPos.current.y) / dt,
    });

    lastPos.current = { x: clientX, y: clientY, time: now };
    setPosition({ x: newX, y: newY });
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);

    // ✅ FORCE RIGHT SIDE ONLY
    const snapX = window.innerWidth - BUBBLE_SIZE - MARGIN;

    let snapY = position.y + velocity.y * 150;
    snapY = Math.min(
      Math.max(snapY, 10),
      window.innerHeight - BUBBLE_SIZE - 10
    );

    setPosition({ x: snapX, y: snapY });
  };

  /* ================= EVENTS ================= */
  useEffect(() => {
    const handleMouseMove = (e) => moveDrag(e.clientX, e.clientY);
    const handleMouseUp = () => endDrag();

    const handleTouchMove = (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    };

    const handleTouchEnd = () => endDrag();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragging, position, velocity]);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  /* ================= FOCUS ================= */
  useEffect(() => {
    if (open) {
      document.querySelector(".chat-footer input")?.focus();
    }
  }, [open]);

  /* ================= SEND ================= */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: input }]);
    const userText = input;
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        apiUrl || "https://unprogressively-noncognitive-karis.ngrok-free.dev/api/chat",
        { message: userText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const aiReply = res.data?.reply || "No response.";
      setMessages((prev) => [...prev, { role: "ai", text: aiReply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Error connecting to AI server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  /* ================= JSX ================= */
  return (
    <>
      <div
        ref={bubbleRef}
        className="assistant-bubble"
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          startDrag(t.clientX, t.clientY);
        }}
        onClick={() => !dragging && setOpen(!open)}
        style={{
          left: `${position.x}px`,
          top: `${Math.min(position.y, window.innerHeight - 150)}px`,
          transition: dragging ? "none" : "all 0.3s ease-out",
          zIndex: 600,
        }}
      >
        💬
      </div>

      {open && (
        <div className="chat-box">
          <div className="chat-header">
            <h4>AI Librarian</h4>
            <button onClick={() => setOpen(false)}>✖</button>
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="chat-message ai">Typing...</div>}
          </div>

          <div className="chat-footer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
  

      <style jsx>{`
        .assistant-bubble {
          position: fixed;
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #43a047, #fdd835);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 2rem;
          cursor: grab;
          z-index: 150;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          user-select: none;
          touch-action: none; /* only block touch when dragging */
        }

        .chat-box {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: min(90vw, 340px);
          height: 50vh;
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 140;
        }

        .chat-header {
          background: linear-gradient(90deg, #388e3c, #fdd835);
          color: #fff;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
        }

        .chat-body {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chat-message {
          padding: 8px 12px;
          border-radius: 14px;
          max-width: 85%;
          font-size: 0.9rem;
        }

        .chat-message.user {
          align-self: flex-end;
          background: #e0f7fa;
        }

        .chat-message.ai {
          align-self: flex-start;
          background: #fff9c4;
        }

        .typing {
          opacity: 0.7;
          font-style: italic;
        }

        .chat-footer {
          display: flex;
          border-top: 1px solid #ddd;
        }

        .chat-footer input {
          flex: 1;
          padding: 10px;
          border: none;
          outline: none;
        }

        .chat-footer button {
          background: #43a047;
          color: white;
          border: none;
          padding: 0 16px;
          cursor: pointer;
        }

        .chat-footer button:disabled {
          background: #9e9e9e;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}