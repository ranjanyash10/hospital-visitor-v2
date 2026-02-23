import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GuardLogin from './pages/guard/GuardLogin';
import GuardDashboard from './pages/guard/GuardDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import VisitorPortal from './pages/visitor/VisitorPortal';
import VisitorRegistrationForm from './pages/visitor/VisitorRegistrationForm';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Routes>
          {/* Visitor Portal (public — scanned via guard QR) */}
          <Route path="/visitor" element={<VisitorPortal />} />
          <Route path="/visitor/register/:uhid" element={<VisitorRegistrationForm />} />

          {/* Guard Routes */}
          <Route path="/" element={<GuardLogin />} />
          <Route path="/guard/login" element={<GuardLogin />} />
          <Route
            path="/guard"
            element={
              <ProtectedRoute roles={['GUARD', 'ADMIN']}>
                <GuardDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
