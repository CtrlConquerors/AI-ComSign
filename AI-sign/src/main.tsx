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

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/translator" element={<App />} />
                <Route path="/admin/extraction" element={<AdminExtraction />} />
                <Route path="/lessons" element={<LessonPage />} />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
);