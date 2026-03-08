import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './Admin.css';

const AdminLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const navLinks = [
        { path: '/admin', label: 'Dashboard' },
        { path: '/admin/users', label: 'Users' },
        { path: '/admin/lessons', label: 'Lessons' },
        { path: '/admin/extraction', label: 'Sign Library' },
    ];

    // Simple path active check
    const isActive = (path: string) => {
        if (path === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <Link to="/" className="admin-logo" style={{ textDecoration: 'none', color: '#38bdf8' }}>
                    SignBridge Admin
                </Link>
                <nav className="admin-nav">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`admin-nav-link ${isActive(link.path) ? 'active' : ''}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <div className="admin-sidebar-footer">
                    <button className="admin-logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                        <Link to="/" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Back to Home</Link>
                    </div>
                </div>
            </aside>
            
            <main className="admin-main">
                <header className="admin-header">
                    <h1>{navLinks.find(l => isActive(l.path))?.label || 'Admin Panel'}</h1>
                </header>
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
