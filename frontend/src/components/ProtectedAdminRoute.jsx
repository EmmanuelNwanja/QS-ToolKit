import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * ProtectedAdminRoute - Wrapper to ensure only admins can access certain pages
 */
export default function ProtectedAdminRoute({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        // Verify user is admin by calling an admin endpoint
        const response = await fetch('/api/admin/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 403) {
          // User is not admin
          router.push('/dashboard');
          return;
        }

        if (response.ok) {
          setIsAdmin(true);
          setLoading(false);
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Admin auth check failed:', err);
        router.push('/auth/login');
      }
    };

    checkAdminAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}
