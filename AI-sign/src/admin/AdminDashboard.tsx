import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface DashboardStats {
    totalUsers: number;
    totalLessons: number;
    totalSigns: number;
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        totalLessons: 0,
        totalSigns: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/admin/users/stats');
                setStats(res.data);
            } catch (err) {
                console.error("Failed to load stats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div>Loading dashboard...</div>;

    return (
        <div>
            <div className="admin-stats-grid">
                <div className="admin-stat-card">
                    <h3>Total Users</h3>
                    <p>{stats.totalUsers}</p>
                </div>
                <div className="admin-stat-card">
                    <h3>Total Lessons</h3>
                    <p>{stats.totalLessons}</p>
                </div>
                <div className="admin-stat-card">
                    <h3>Total Signs in Library</h3>
                    <p>{stats.totalSigns}</p>
                </div>
            </div>
            
            <div className="admin-table-container" style={{ padding: '24px' }}>
                <h2>Welcome to the Admin Dashboard</h2>
                <p>Use the sidebar navigation to manage users, lessons, and the sign library.</p>
            </div>
        </div>
    );
};

export default AdminDashboard;
