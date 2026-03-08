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

import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import ProtectedRoute from './admin/ProtectedRoute';

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/translator" element={<App />} />
                <Route path="/lessons" element={<LessonPage />} />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

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
                    <Route path="lessons" element={<LessonPage />} />
                    <Route path="extraction" element={<AdminExtraction />} />
                </Route>
            </Routes>
        </BrowserRouter>
    </StrictMode>
);