import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api/axios';
import './Auth.css';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        phoneNumber: '',
        dateOfBirth: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/Auth/register', formData);
            alert("Đăng ký thành công!");
            navigate('/login');
        } catch (err: any) {
            alert(err.response?.data || "Có lỗi xảy ra");
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="hero-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    Join SignBridge
                </h2>
                <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                    <label className="auth-label">Full Name</label>
                    <input type="text" className="auth-input" required
                        onChange={e => setFormData({ ...formData, name: e.target.value })} />

                    <label className="auth-label">Email Address</label>
                    <input type="email" className="auth-input" required
                        onChange={e => setFormData({ ...formData, email: e.target.value })} />

                    <label className="auth-label">Password</label>
                    <input type="password" className="auth-input" required
                        onChange={e => setFormData({ ...formData, password: e.target.value })} />

                    <label className="auth-label">Date of Birth</label>
                    <input type="date" className="auth-input" required
                        onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} />

                    <button type="submit" className="pill-btn" style={{ width: '100%', marginTop: '2rem' }}>
                        Create Account
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem', color: '#94a3b8' }}>
                    Already have an account? <Link to="/login" style={{ color: '#3b82f6' }}>Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;