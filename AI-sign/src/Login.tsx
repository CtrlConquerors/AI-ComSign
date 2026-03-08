import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api/axios';
import './Auth.css';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/Auth/login', { email, password });
            localStorage.setItem('token', res.data.token);
            alert("Welcome back!");
            navigate('/');
        } catch (err: any) {
            alert("Invalid credentials");
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="hero-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    Welcome Back
                </h2>
                <form onSubmit={handleLogin} style={{ marginTop: '1.5rem' }}>
                    <label className="auth-label">Email Address</label>
                    <input type="email" className="auth-input" required
                        onChange={e => setEmail(e.target.value)} />

                    <label className="auth-label">Password</label>
                    <input type="password" className="auth-input" required
                        onChange={e => setPassword(e.target.value)} />

                    <button type="submit" className="pill-btn" style={{ width: '100%', marginTop: '2rem' }}>
                        Sign In
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem', color: '#94a3b8' }}>
                    New to SignBridge? <Link to="/register" style={{ color: '#3b82f6' }}>Create an account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;