import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api/axios';
import './Auth.css';

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
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
            const res = await api.post('/Auth/forgot-password', { email });
            setStatus({ message: 'Reset token generated! Redirecting...', type: 'success' });
            
            setTimeout(() => {
                navigate(`/reset-password?token=${res.data.token}`);
            }, 1000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.response?.data || 'An error occurred while processing your request.';
            setStatus({ 
                message: typeof errorMessage === 'string' ? errorMessage : 'An error occurred', 
                type: 'error' 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="hero-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    Forgot Password
                </h2>
                <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Enter your email to receive a password reset link.
                </p>

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
                    <label className="auth-label">Email Address</label>
                    <input 
                        type="email" 
                        className="auth-input" 
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)} 
                        disabled={loading}
                    />

                    <button 
                        type="submit" 
                        className="pill-btn" 
                        style={{ width: '100%', marginTop: '2rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#94a3b8' }}>
                    Remember your password? <Link to="/login" style={{ color: '#3b82f6' }}>Back to Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
