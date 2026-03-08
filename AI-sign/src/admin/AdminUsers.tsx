import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
}

const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to load users", err);
            alert("Failed to load users. Ensure you have Admin privileges.");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'Admin' ? 'Learner' : 'Admin';
        
        if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
            return;
        }

        try {
            await api.put(`/admin/users/${userId}/role`, { role: newRole });
            alert(`Role updated to ${newRole}`);
            fetchUsers();
        } catch (err) {
            console.error("Failed to update role", err);
            alert("Failed to update role");
        }
    };

    const handleDelete = async (userId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this user?")) {
            return;
        }

        try {
            await api.delete(`/admin/users/${userId}`);
            alert("User deleted");
            fetchUsers();
        } catch (err) {
            console.error("Failed to delete user", err);
            alert("Failed to delete user");
        }
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div className="admin-table-container">
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td style={{ fontWeight: 500 }}>{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                                <span className={`role-badge ${user.role.toLowerCase()}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                            <td>
                                {user.role === 'Admin' ? (
                                    <button 
                                        className="admin-action-btn demote"
                                        onClick={() => handleRoleChange(user.id, user.role)}
                                    >
                                        Demote
                                    </button>
                                ) : (
                                    <button 
                                        className="admin-action-btn promote"
                                        onClick={() => handleRoleChange(user.id, user.role)}
                                    >
                                        Promote
                                    </button>
                                )}
                                <button 
                                    className="admin-action-btn delete"
                                    onClick={() => handleDelete(user.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>
                                No users found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default AdminUsers;
