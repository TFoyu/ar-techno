'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import '../../admin.css';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Frame form modal
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [editingFrame, setEditingFrame] = useState(null);
  const [frameName, setFrameName] = useState('');
  const [frameDesc, setFrameDesc] = useState('');
  const [frameFile, setFrameFile] = useState(null);
  const [frameFileName, setFrameFileName] = useState('');
  const [saving, setSaving] = useState(false);

  // Point editor
  const [selectedFrameForPoints, setSelectedFrameForPoints] = useState(null);
  const [points, setPoints] = useState([]);
  const [showPointModal, setShowPointModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [newPointPos, setNewPointPos] = useState(null);
  const [pointTitle, setPointTitle] = useState('');
  const [pointDesc, setPointDesc] = useState('');

  // Face center editor
  const [selectedFrameForCenter, setSelectedFrameForCenter] = useState(null);
  const [faceCenterX, setFaceCenterX] = useState(50);
  const [faceCenterY, setFaceCenterY] = useState(42);
  const [savingCenter, setSavingCenter] = useState(false);

  const pointImageRef = useRef(null);
  const centerImageRef = useRef(null);

  // Check auth on mount
  useEffect(() => {
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) {
          router.push('/admin');
        }
      })
      .catch(() => router.push('/admin'));
  }, [router]);

  // Fetch frames
  const fetchFrames = useCallback(async () => {
    try {
      const res = await fetch('/api/frames/all');
      const data = await res.json();
      setFrames(data.frames || []);
    } catch (err) {
      console.error('Error fetching frames:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFrames(); }, [fetchFrames]);

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/admin');
  };

  // ===== FRAME CRUD =====
  const openAddFrame = () => {
    setEditingFrame(null);
    setFrameName('');
    setFrameDesc('');
    setFrameFile(null);
    setFrameFileName('');
    setShowFrameModal(true);
  };

  const openEditFrame = (frame) => {
    setEditingFrame(frame);
    setFrameName(frame.name);
    setFrameDesc(frame.description || '');
    setFrameFile(null);
    setFrameFileName('');
    setShowFrameModal(true);
  };

  const saveFrame = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingFrame) {
        // Update
        await fetch(`/api/frames/${editingFrame.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: frameName, description: frameDesc }),
        });
      } else {
        // Create
        const formData = new FormData();
        formData.append('name', frameName);
        formData.append('description', frameDesc);
        formData.append('image', frameFile);

        await fetch('/api/frames', {
          method: 'POST',
          body: formData,
        });
      }

      setShowFrameModal(false);
      fetchFrames();
    } catch (err) {
      console.error('Error saving frame:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleFrameActive = async (frame) => {
    await fetch(`/api/frames/${frame.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: frame.is_active ? 0 : 1 }),
    });
    fetchFrames();
  };

  const deleteFrame = async (frame) => {
    if (!confirm(`Hapus frame "${frame.name}"? Semua poin terkait juga akan dihapus.`)) return;
    await fetch(`/api/frames/${frame.id}`, { method: 'DELETE' });
    fetchFrames();
  };

  // ===== POINT EDITOR =====
  const openPointEditor = async (frame) => {
    setSelectedFrameForPoints(frame);
    setActiveTab('points');
    // Fetch points
    const res = await fetch(`/api/points?frame_id=${frame.id}`);
    const data = await res.json();
    setPoints(data.points || []);
  };

  const fetchPoints = async (frameId) => {
    const res = await fetch(`/api/points?frame_id=${frameId}`);
    const data = await res.json();
    setPoints(data.points || []);
  };

  const handleImageClick = (e) => {
    if (!pointImageRef.current) return;
    const rect = pointImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewPointPos({ x: x.toFixed(2), y: y.toFixed(2) });
    setEditingPoint(null);
    setPointTitle('');
    setPointDesc('');
    setShowPointModal(true);
  };

  const savePoint = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingPoint) {
        await fetch(`/api/points/${editingPoint.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: pointTitle, description: pointDesc }),
        });
      } else {
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame_id: selectedFrameForPoints.id,
            x_percent: parseFloat(newPointPos.x),
            y_percent: parseFloat(newPointPos.y),
            title: pointTitle,
            description: pointDesc,
          }),
        });
      }

      setShowPointModal(false);
      fetchPoints(selectedFrameForPoints.id);
      fetchFrames();
    } catch (err) {
      console.error('Error saving point:', err);
    } finally {
      setSaving(false);
    }
  };

  const editPoint = (point) => {
    setEditingPoint(point);
    setPointTitle(point.title);
    setPointDesc(point.description);
    setNewPointPos(null);
    setShowPointModal(true);
  };

  const deletePoint = async (point) => {
    if (!confirm(`Hapus poin "${point.title}"?`)) return;
    await fetch(`/api/points/${point.id}`, { method: 'DELETE' });
    fetchPoints(selectedFrameForPoints.id);
    fetchFrames();
  };

  // ===== FACE CENTER EDITOR =====
  const openCenterEditor = (frame) => {
    setSelectedFrameForCenter(frame);
    setFaceCenterX(parseFloat(frame.face_center_x) || 50);
    setFaceCenterY(parseFloat(frame.face_center_y) || 42);
    setActiveTab('center');
  };

  const handleCenterImageClick = (e) => {
    if (!centerImageRef.current) return;
    const rect = centerImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFaceCenterX(parseFloat(x.toFixed(2)));
    setFaceCenterY(parseFloat(y.toFixed(2)));
  };

  const saveFaceCenter = async () => {
    if (!selectedFrameForCenter) return;
    setSavingCenter(true);
    try {
      await fetch(`/api/frames/${selectedFrameForCenter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_center_x: faceCenterX, face_center_y: faceCenterY }),
      });
      fetchFrames();
      setSelectedFrameForCenter(null);
      setActiveTab('frames');
    } catch (err) {
      console.error('Error saving face center:', err);
    } finally {
      setSavingCenter(false);
    }
  };

  // Stats
  const totalFrames = frames.length;
  const activeFrames = frames.filter(f => f.is_active).length;
  const totalPoints = frames.reduce((sum, f) => sum + (parseInt(f.point_count) || 0), 0);

  return (
    <div className="admin-layout">
      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🏛️ AR Photo Booth</h2>
          <p>Admin Panel</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📊</span> Dashboard
          </button>
          <button
            className={activeTab === 'frames' ? 'active' : ''}
            onClick={() => { setActiveTab('frames'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">🖼️</span> Kelola Frame
          </button>
          <button
            className={activeTab === 'points' ? 'active' : ''}
            onClick={() => { setActiveTab('points'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📍</span> Editor Poin
          </button>
          <button
            className={activeTab === 'center' ? 'active' : ''}
            onClick={() => { setActiveTab('center'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">🎯</span> Atur Center
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout}>
            🚪 Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === 'dashboard' && (
          <>
            <div className="admin-page-header">
              <h1>Dashboard</h1>
              <p>Ringkasan sistem AR Photo Booth</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🖼️</div>
                <div className="stat-value">{totalFrames}</div>
                <div className="stat-label">Total Frame</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{activeFrames}</div>
                <div className="stat-label">Frame Aktif</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📍</div>
                <div className="stat-value">{totalPoints}</div>
                <div className="stat-label">Total Poin Sejarah</div>
              </div>
            </div>

            {/* Recent frames */}
            <div className="admin-table-wrapper">
              <div className="admin-table-header">
                <h3>Frame Terbaru</h3>
                <button className="btn-primary" onClick={() => setActiveTab('frames')}>
                  Lihat Semua →
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Nama</th>
                    <th>Status</th>
                    <th>Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {frames.slice(0, 5).map(frame => (
                    <tr key={frame.id}>
                      <td><img src={frame.image_path} alt={frame.name} className="frame-thumb" /></td>
                      <td>{frame.name}</td>
                      <td>
                        <span className={`status-badge ${frame.is_active ? 'active' : 'inactive'}`}>
                          {frame.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>{frame.point_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== FRAMES TAB ===== */}
        {activeTab === 'frames' && (
          <>
            <div className="admin-page-header">
              <h1>Kelola Frame</h1>
              <p>Tambah, edit, dan hapus frame foto AR</p>
            </div>

            <div className="admin-table-wrapper">
              <div className="admin-table-header">
                <h3>Daftar Frame ({frames.length})</h3>
                <button className="btn-primary" onClick={openAddFrame}>
                  + Tambah Frame
                </button>
              </div>

              {frames.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🖼️</div>
                  <h3>Belum Ada Frame</h3>
                  <p>Klik tombol "Tambah Frame" untuk mulai</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Nama</th>
                      <th>Deskripsi</th>
                      <th>Status</th>
                      <th>Poin</th>
                      <th>Urutan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map(frame => (
                      <tr key={frame.id}>
                        <td><img src={frame.image_path} alt={frame.name} className="frame-thumb" /></td>
                        <td style={{ fontWeight: 600 }}>{frame.name}</td>
                        <td style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-muted)' }}>
                          {frame.description ? (frame.description.length > 60 ? frame.description.slice(0, 60) + '...' : frame.description) : '-'}
                        </td>
                        <td>
                          <span className={`status-badge ${frame.is_active ? 'active' : 'inactive'}`}>
                            {frame.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>{frame.point_count || 0}</td>
                        <td>{frame.sort_order}</td>
                        <td>
                          <button className="btn-action" title="Edit" onClick={() => openEditFrame(frame)}>✏️</button>
                          <button className="btn-action" title="Toggle Status" onClick={() => toggleFrameActive(frame)}>
                            {frame.is_active ? '🔴' : '🟢'}
                          </button>
                          <button className="btn-action" title="Atur Center" onClick={() => openCenterEditor(frame)}>🎯</button>
                          <button className="btn-action" title="Edit Poin" onClick={() => openPointEditor(frame)}>📍</button>
                          <button className="btn-action delete" title="Hapus" onClick={() => deleteFrame(frame)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== POINTS EDITOR TAB ===== */}
        {activeTab === 'points' && (
          <>
            <div className="admin-page-header">
              <h1>Editor Poin Sejarah</h1>
              <p>Klik pada gambar frame untuk menambahkan poin deskripsi sejarah</p>
            </div>

            {!selectedFrameForPoints ? (
              <div className="admin-table-wrapper">
                <div className="admin-table-header">
                  <h3>Pilih Frame untuk Edit Poin</h3>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Nama</th>
                      <th>Poin</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map(frame => (
                      <tr key={frame.id}>
                        <td><img src={frame.image_path} alt={frame.name} className="frame-thumb" /></td>
                        <td style={{ fontWeight: 600 }}>{frame.name}</td>
                        <td>{frame.point_count || 0} poin</td>
                        <td>
                          <button className="btn-primary" onClick={() => openPointEditor(frame)}>
                            📍 Edit Poin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <button
                  className="btn-outline"
                  onClick={() => setSelectedFrameForPoints(null)}
                  style={{ marginBottom: 16 }}
                >
                  ← Kembali ke Daftar Frame
                </button>

                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
                  Frame: {selectedFrameForPoints.name}
                </h3>

                <div className="point-editor-container">
                  {/* Image with points - smaller & scrollable */}
                  <div className="point-editor-image point-editor-image--compact" onClick={handleImageClick} ref={pointImageRef}>
                    <img
                      src={selectedFrameForPoints.image_path}
                      alt={selectedFrameForPoints.name}
                      draggable={false}
                    />
                    {points.map((point, idx) => (
                      <div
                        key={point.id}
                        className="editor-point"
                        style={{ left: `${point.x_percent}%`, top: `${point.y_percent}%` }}
                        onClick={(e) => { e.stopPropagation(); editPoint(point); }}
                        title={point.title}
                      >
                        {idx + 1}
                      </div>
                    ))}
                  </div>

                  {/* Point list sidebar */}
                  <div className="point-editor-sidebar">
                    <h4>📍 Daftar Poin ({points.length})</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Klik pada gambar untuk menambah poin baru
                    </p>

                    {points.length === 0 ? (
                      <div className="empty-state" style={{ padding: 20 }}>
                        <p>Belum ada poin. Klik pada gambar untuk menambahkan.</p>
                      </div>
                    ) : (
                      points.map((point, idx) => (
                        <div key={point.id} className="point-list-item">
                          <div className="point-number">{idx + 1}</div>
                          <div className="point-info">
                            <div className="point-title">{point.title}</div>
                            <div className="point-desc">{point.description}</div>
                          </div>
                          <div className="point-actions">
                            <button className="btn-action" title="Edit" onClick={() => editPoint(point)}>✏️</button>
                            <button className="btn-action delete" title="Hapus" onClick={() => deletePoint(point)}>🗑️</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ===== FACE CENTER EDITOR TAB ===== */}
        {activeTab === 'center' && (
          <>
            <div className="admin-page-header">
              <h1>🎯 Atur Center Wajah</h1>
              <p>Klik pada gambar frame untuk menentukan titik center deteksi wajah</p>
            </div>

            {!selectedFrameForCenter ? (
              <div className="admin-table-wrapper">
                <div className="admin-table-header">
                  <h3>Pilih Frame untuk Atur Center</h3>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Nama</th>
                      <th>Center Saat Ini</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map(frame => (
                      <tr key={frame.id}>
                        <td><img src={frame.image_path} alt={frame.name} className="frame-thumb" /></td>
                        <td style={{ fontWeight: 600 }}>{frame.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          X: {parseFloat(frame.face_center_x || 50).toFixed(1)}%, Y: {parseFloat(frame.face_center_y || 42).toFixed(1)}%
                        </td>
                        <td>
                          <button className="btn-primary" onClick={() => openCenterEditor(frame)}>
                            🎯 Atur Center
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <button
                  className="btn-outline"
                  onClick={() => setSelectedFrameForCenter(null)}
                  style={{ marginBottom: 16 }}
                >
                  ← Kembali ke Daftar Frame
                </button>

                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
                  Frame: {selectedFrameForCenter.name}
                </h3>

                <div className="point-editor-container">
                  {/* Image with center marker */}
                  <div className="point-editor-image point-editor-image--compact" onClick={handleCenterImageClick} ref={centerImageRef}>
                    <img
                      src={selectedFrameForCenter.image_path}
                      alt={selectedFrameForCenter.name}
                      draggable={false}
                    />
                    {/* Center crosshair marker */}
                    <div
                      className="center-marker"
                      style={{ left: `${faceCenterX}%`, top: `${faceCenterY}%` }}
                    >
                      <div className="center-marker-cross" />
                    </div>
                  </div>

                  {/* Controls sidebar */}
                  <div className="point-editor-sidebar">
                    <h4>🎯 Pengaturan Center Wajah</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Klik pada gambar frame untuk menentukan posisi center wajah. Titik ini akan menjadi titik acuan dimana wajah akan diposisikan di dalam frame.
                    </p>

                    <div className="form-group">
                      <label>Center X (%)</label>
                      <input
                        type="number"
                        value={faceCenterX}
                        onChange={e => setFaceCenterX(parseFloat(e.target.value) || 0)}
                        min="0" max="100" step="0.5"
                      />
                    </div>

                    <div className="form-group">
                      <label>Center Y (%)</label>
                      <input
                        type="number"
                        value={faceCenterY}
                        onChange={e => setFaceCenterY(parseFloat(e.target.value) || 0)}
                        min="0" max="100" step="0.5"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button
                        className="btn-outline"
                        onClick={() => { setFaceCenterX(50); setFaceCenterY(42); }}
                      >
                        Reset Default
                      </button>
                      <button
                        className="btn-primary"
                        onClick={saveFaceCenter}
                        disabled={savingCenter}
                      >
                        {savingCenter ? 'Menyimpan...' : '💾 Simpan Center'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ===== FRAME MODAL ===== */}
      {showFrameModal && (
        <div className="modal-backdrop" onClick={() => setShowFrameModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingFrame ? 'Edit Frame' : 'Tambah Frame Baru'}</h3>
              <button className="modal-close" onClick={() => setShowFrameModal(false)}>×</button>
            </div>

            <form className="modal-form" onSubmit={saveFrame}>
              <div className="form-group">
                <label>Nama Frame *</label>
                <input
                  type="text"
                  value={frameName}
                  onChange={e => setFrameName(e.target.value)}
                  placeholder="Contoh: Kafe Merah Putih - Heritage"
                  required
                />
              </div>

              <div className="form-group">
                <label>Deskripsi</label>
                <textarea
                  value={frameDesc}
                  onChange={e => setFrameDesc(e.target.value)}
                  placeholder="Deskripsi singkat frame..."
                />
              </div>

              {!editingFrame && (
                <div className="form-group">
                  <label>Gambar Frame (PNG dengan area transparan) *</label>
                  <div className="file-upload-area">
                    <div className="upload-icon">📁</div>
                    <p>Klik atau seret file ke sini</p>
                    {frameFileName && <div className="filename">{frameFileName}</div>}
                    <input
                      type="file"
                      accept="image/png"
                      onChange={e => {
                        setFrameFile(e.target.files[0]);
                        setFrameFileName(e.target.files[0]?.name || '');
                      }}
                      required={!editingFrame}
                    />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowFrameModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : (editingFrame ? 'Simpan Perubahan' : 'Tambah Frame')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== POINT MODAL ===== */}
      {showPointModal && (
        <div className="modal-backdrop" onClick={() => setShowPointModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPoint ? 'Edit Poin' : 'Tambah Poin Baru'}</h3>
              <button className="modal-close" onClick={() => setShowPointModal(false)}>×</button>
            </div>

            <form className="modal-form" onSubmit={savePoint}>
              {newPointPos && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  📍 Posisi: X={newPointPos.x}%, Y={newPointPos.y}%
                </p>
              )}

              <div className="form-group">
                <label>Judul Poin *</label>
                <input
                  type="text"
                  value={pointTitle}
                  onChange={e => setPointTitle(e.target.value)}
                  placeholder="Contoh: Proklamasi Kemerdekaan"
                  required
                />
              </div>

              <div className="form-group">
                <label>Deskripsi Sejarah *</label>
                <textarea
                  value={pointDesc}
                  onChange={e => setPointDesc(e.target.value)}
                  placeholder="Masukkan deskripsi sejarah yang merepresentasikan elemen gambar ini..."
                  required
                  style={{ minHeight: 120 }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowPointModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : (editingPoint ? 'Simpan Perubahan' : 'Tambah Poin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
