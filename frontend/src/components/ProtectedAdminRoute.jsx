import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { adminAPI } from '../services/api';

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
        await adminAPI.verify();
        setIsAdmin(true);
        setLoading(false);
      } catch (err) {
        console.error('Admin auth check failed:', err);
        if (err.response?.status === 403) {
          router.push('/dashboard');
        } else {
          router.push('/auth/login');
        }
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
