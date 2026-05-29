// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { AuthContext } from "./context/AuthContext";
import socket from "./socket";
import { toast } from "react-hot-toast";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentHome from "./pages/StudentHome";
import BookDetail from "./pages/BookDetail";
import BrowseBooks from "./pages/BrowseBooks";
import BrowseEbooks from "./pages/BrowseEbooks";
import ScanQR from "./pages/ScanQR";
import Notification from "./pages/NotificationsPage";
import Profile from "./pages/Profile";
import UserBorrowPage from "./pages/UserBorrowPage";
import SupportChat from "./pages/user_sidechat";
import EbookView from "./pages/EbookView";

// Admin Pages
import AddBook from "./pages/admin/AddBook";
import BookManagement from "./pages/admin/BookManagement";
import EditBook from "./pages/admin/EditBook";
import ViewBook from "./pages/admin/ViewBook";
import UserManagement from "./pages/admin/UserManagement";
import AddUser from "./pages/admin/AddUser";
import EditUser from "./pages/admin/EditUser";
import Dashboard from "./pages/admin/Dashboard";
import Report from "./pages/admin/ReportsManagement";
import QRPrinting from "./pages/admin/QRPrinting";
import AdminChat from "./pages/admin/AdminChat";
import AdminBorrow from "./pages/admin/AdminBorrow";

import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import ActiveBorrowManagement from "./pages/admin/ActiveBorrowManagement";

// Components
import AiAssistant from "./components/AiAssistant";
import BottomNav from "./components/BottomNav";

// ============================
// 🔹 Notification Listener
// ============================
// ...existing code...
function NotificationListener() {
  const { user, token } = useContext(AuthContext);

  useEffect(() => {
    if (!user || !token) return;

    // always set auth for the socket
    socket.auth = { token };

    // connect if not already connected
    if (!socket.connected) socket.connect();

    // always emit join so the server adds this socket to the user_<id> room
    socket.emit("join", user.id);

    const handleNotification = (data) => {
      console.log("📩 Notification:", data);

      toast.custom(
        <div className="bg-green-500 text-white p-2 rounded shadow">
          {data.message}
        </div>
      );
    };

    socket.on("newNotification", handleNotification);

    return () => {
      socket.off("newNotification", handleNotification);
      // do not disconnect here
    };
  }, [user, token]);

  return null;
}
// ...existing code...
// ============================
// 🔹 Protected Route
// ============================
function ProtectedRoute({ children, role }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}

// ============================
// 🔹 Student Layout
// ============================
function StudentLayout({ children }) {
  return (
    <div className="student-layout">
      <NotificationListener />
      {children}
      <AiAssistant />
     
    </div>
  );
}

// ============================
// 🔹 App Component
// ============================
export default function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <p>Loading app...</p>;

  return (
    <Routes>
      {/* Default Route */}
      <Route
        path="/"
        element={
          user ? (
            user.role === "admin" ? (
              <Navigate to="/admin/BookManagement" replace />
            ) : (
              <Navigate to="/home" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Auth Routes */}
      <Route
        path="/login"
        element={
          !user ? (
            <Login />
          ) : user.role === "admin" ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/home" replace />
          )
        }
      />
      <Route
        path="/register"
        element={
          !user ? (
            <Register />
          ) : user.role === "admin" ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/home" replace />
          )
        }
      />

      {/* ================= STUDENT ROUTES ================= */}
      <Route
        path="/SupportChat"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <SupportChat/>
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
path="/EbookView/:id"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <EbookView/>
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/UserBorrowPage"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <UserBorrowPage/>
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <StudentHome />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/books/:id"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <BookDetail />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/BrowseBooks"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <BrowseBooks />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/Profile"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <Profile />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/BrowseEbooks"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <BrowseEbooks />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <ScanQR />
            </StudentLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/Notification"
        element={
          <ProtectedRoute role="student">
            <StudentLayout>
              <Notification/>
            </StudentLayout>
          </ProtectedRoute>
        }
      />


      {/* ================= ADMIN ROUTES ================= */}
<Route
        path="/admin/ChatManagement"
        element={
          <ProtectedRoute role="admin">
            <AdminChat />
          </ProtectedRoute>
        }
      />
<Route
        path="/admin/ActiveBorrowManagement"
        element={
          <ProtectedRoute role="admin">
            <ActiveBorrowManagement />
          </ProtectedRoute>
        }
      />

<Route
        path="/admin/AdminUserDetail/:id"
        element={
          <ProtectedRoute role="admin">
            <AdminUserDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/AdminNotifications"
        element={
          <ProtectedRoute role="admin">
            <AdminNotifications />
          </ProtectedRoute>
        }
      />
<Route
        path="/admin/AdminBorrow"
        element={
          <ProtectedRoute role="admin">
            <AdminBorrow />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/BookManagement"
        element={
          <ProtectedRoute role="admin">
            <BookManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-book"
        element={
          <ProtectedRoute role="admin">
            <AddBook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/edit-book/:id"
        element={
          <ProtectedRoute role="admin">
            <EditBook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/books/:id"
        element={
          <ProtectedRoute role="admin">
            <ViewBook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/UserManagement"
        element={
          <ProtectedRoute role="admin">
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-user"
        element={
          <ProtectedRoute role="admin">
            <AddUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/edit-user/:id"
        element={
          <ProtectedRoute role="admin">
            <EditUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/QRPrinting"
        element={
          <ProtectedRoute role="admin">
            <QRPrinting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/Report"
        element={
          <ProtectedRoute role="admin">
            <Report />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}