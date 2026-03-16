import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api/axios';
import './Auth.css';

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: '',
        phone: ''
    });
    
    const [profile, setProfile] = useState<{ email: string; role: string; fullName: string; phone: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({
        message: '',
        type: null,
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/Auth/profile');
                setProfile(res.data);
                setFormData({
                    fullName: res.data.fullName || '',
                    phone: res.data.phone || ''
                });
            } catch (err) {
                console.error("Failed to load profile", err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus({ message: '', type: null });

        try {
            const res = await api.put('/Auth/profile', formData);
            setProfile(res.data);
            setStatus({ message: 'Profile updated successfully!', type: 'success' });
        } catch (err: any) {
            console.error("Failed to update profile", err);
            const errorMessage = err.response?.data?.message || err.response?.data || "An error occurred while updating the profile.";
            setStatus({ 
                message: typeof errorMessage === 'string' ? errorMessage : 'Update failed', 
                type: 'error' 
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="auth-page">
                <div style={{ color: 'white', textAlign: 'center' }}>Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="hero-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    Your Profile
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

                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    <p><strong>Email:</strong> {profile?.email}</p>
                    <p><strong>Role:</strong> {profile?.role}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <label className="auth-label">Full Name</label>
                    <input 
                        type="text" 
                        className="auth-input" 
                        required
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })} 
                        disabled={saving} 
                    />

                    <label className="auth-label">Phone Number</label>
                    <input 
                        type="tel" 
                        className="auth-input" 
                        required
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                        disabled={saving} 
                    />

                    <button type="submit" className="pill-btn" style={{ width: '100%', marginTop: '2rem' }} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    
                    <button type="button" className="ghost-btn" style={{ width: '100%', marginTop: '1rem' }} onClick={() => navigate('/')}>
                        Back to Home
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Profile;
