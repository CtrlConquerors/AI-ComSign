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

    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({
        message: '',
        type: null,
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ message: '', type: null });

        try {
            const res = await api.post('/Auth/register', formData);
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            setStatus({ message: 'Registration successful! Logging in...', type: 'success' });
            setTimeout(() => {
                navigate('/');
            }, 1000);
        } catch (err: any) {
            console.error("Registration error:", err);
            
            let errorMessage = "An error occurred during registration.";
            
            if (err.response && err.response.data) {
                const data = err.response.data;
                if (typeof data === 'string') {
                    errorMessage = data;
                } else if (data.message) {
                    errorMessage = data.message;
                } else if (data.errors) {
                    // Parse ASP.NET Core validation errors dictionary
                    const errors = Object.values(data.errors).flat() as string[];
                    errorMessage = errors.join(' ');
                } else if (data.title) {
                    errorMessage = data.title;
                } else {
                    errorMessage = JSON.stringify(data);
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            setStatus({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="hero-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    Join SignBridge
                </h2>
                
                {status.message && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: status.type === 'success' ? '#10b98120' : '#ef444420',
                        color: status.type === 'success' ? '#10b981' : '#ef4444',
                        textAlign: 'center',
                        fontSize: '0.9rem'
                    }}>
                        {status.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                    <label className="auth-label">Full Name</label>
                    <input type="text" className="auth-input" required
                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                        disabled={loading} />

                    <label className="auth-label">Email Address</label>
                    <input type="email" className="auth-input" required
                        onChange={e => setFormData({ ...formData, email: e.target.value })} 
                        disabled={loading} />

                    <label className="auth-label">Password</label>
                    <input type="password" className="auth-input" required
                        onChange={e => setFormData({ ...formData, password: e.target.value })} 
                        disabled={loading} />

                    <label className="auth-label">Phone Number</label>
                    <input type="tel" className="auth-input" required
                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} 
                        disabled={loading} />

                    <label className="auth-label">Date of Birth</label>
                    <input type="date" className="auth-input" required
                        onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} 
                        disabled={loading} />

                    <button type="submit" className="pill-btn" style={{ width: '100%', marginTop: '2rem' }} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Account'}
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