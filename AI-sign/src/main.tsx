import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import HomePage from './HomePage';
import AdminExtraction from './AdminExtraction';
import LessonPage from './LessonPage';
import Login from './Login'; 
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';

import PracticePage from './PracticePage';
import PracticeSessionPage from './PracticeSessionPage';
import PracticeHistoryPage from './PracticeHistoryPage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminLessons from './admin/AdminLessons';
import ProtectedRoute from './admin/ProtectedRoute';
import ErrorBoundary from './ErrorBoundary';

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <ErrorBoundary>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/translator" element={<App />} />
                <Route path="/lessons" element={<LessonPage />} />

                <Route
                    path="/practice"
                    element={
                        <ProtectedRoute allowedRoles={["Learner", "Admin"]}>
                            <PracticePage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/practice/session"
                    element={
                        <ProtectedRoute allowedRoles={["Learner", "Admin"]}>
                            <PracticeSessionPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/practice/history"
                    element={
                        <ProtectedRoute allowedRoles={["Learner", "Admin"]}>
                            <PracticeHistoryPage />
                        </ProtectedRoute>
                    }
                />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Admin Routes */}
                <Route 
                    path="/admin" 
                    element={
                        <ProtectedRoute allowedRoles={['Admin']}>
                            <AdminLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="lessons" element={<AdminLessons />} />
                    <Route path="extraction" element={<AdminExtraction />} />
                </Route>
            </Routes>
        </BrowserRouter>
        </ErrorBoundary>
    </StrictMode>
);