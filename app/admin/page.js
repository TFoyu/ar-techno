'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '../admin.css';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          router.push('/admin/dashboard');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/admin/dashboard');
      } else {
        setError(data.error || 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="admin-login-page">
        <div className="login-card">
          <div className="loading-spinner" style={{ margin: '40px auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🏛️</div>
          <h1>AR Photo Booth</h1>
          <p>Admin Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="loading-spinner" style={{ width: 18, height: 18 }} />
            ) : 'Masuk'}
          </button>
        </form>

        <div className="login-footer">
          <p>Default: admin / admin123</p>
        </div>
      </div>
    </div>
  );
}
