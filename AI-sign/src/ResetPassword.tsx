import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from './api/axios';
import './Auth.css';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({
        message: '',
        type: null,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tokenParam = queryParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setStatus({ message: 'Invalid or missing token.', type: 'error' });
        }
    }, [location]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token) {
            setStatus({ message: 'Missing token. Check your reset link.', type: 'error' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setStatus({ message: 'Passwords do not match.', type: 'error' });
            return;
        }

        if (newPassword.length < 6) {
            setStatus({ message: 'Password must be at least 6 characters.', type: 'error' });
            return;
        }

        setLoading(true);
        setStatus({ message: '', type: null });

        try {
            await api.post('/Auth/reset-password', { token, newPassword });
            setStatus({ message: 'Password reset successful. You can now log in.', type: 'success' });
            
            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.response?.data || 'Failed to reset password. The token may be expired or invalid.';
            setStatus({ 
                message: typeof errorMessage === 'string' ? errorMessage : 'Invalid or expired token.', 
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
                    Reset Password
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

                <form onSubmit={handleReset} style={{ marginTop: '1.5rem' }}>
                    <label className="auth-label">New Password</label>
                    <input 
                        type="password" 
                        className="auth-input" 
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} 
                        disabled={loading || !token || status.type === 'success'}
                    />

                    <label className="auth-label">Confirm New Password</label>
                    <input 
                        type="password" 
                        className="auth-input" 
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)} 
                        disabled={loading || !token || status.type === 'success'}
                    />

                    <button 
                        type="submit" 
                        className="pill-btn" 
                        style={{ width: '100%', marginTop: '2rem' }}
                        disabled={loading || !token || status.type === 'success'}
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#94a3b8' }}>
                    <Link to="/login" style={{ color: '#3b82f6' }}>Back to Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
