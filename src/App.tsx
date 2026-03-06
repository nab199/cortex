import React, { useState, useEffect } from 'react';
import TestImports from './TestImports';
import SuperAdminDashboard from './components/SuperAdminDashboard';

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  school_id?: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>;
  }

  // Show Super Admin Dashboard for super_admin users
  if (user?.role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  // Default UI for other users
  return (
    <div style={{ padding: 20, background: '#f0f0f0', color: 'black', fontSize: 16 }}>
      <div style={{ marginBottom: 20 }}>
        {user ? (
          <div>
            <h1>Welcome, {user.full_name}!</h1>
            <p>Role: {user.role}</p>
          </div>
        ) : (
          <h1>Please log in</h1>
        )}
      </div>
      <TestImports />
    </div>
  );
}
