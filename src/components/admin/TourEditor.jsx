import React, { useState, useEffect } from 'react';
import { 
  Save, ArrowLeft, Image as ImageIcon, Eye, Plus, Trash2, 
  Check, AlertCircle, Clock, MapPin, Car, DollarSign, Calendar
} from 'lucide-react';
import MediaPickerModal from './MediaPickerModal';

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function TourEditor({ tourId = null }) {
  const isEditing = Boolean(tourId);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    price: 32000000,
    originalPrice: 35000000,
    isFeatured: 0,
    badge: 'Tour Khuyên Dùng',
    durationDays: 7,
    durationNights: 6,
    departureLocation: 'Leh (Ấn Độ)',
    transportation: 'SUV 4x4 theo chuẩn Leh Taxi Union',
    featuredImage: '',
    gallery: [],
    overview: '',
    highlights: [''],
    itinerary: [
      { day: 1, title: 'Hà Nội/TP.HCM - Delhi - Leh | Thích Nghi Độ Cao', content: 'Đáp chuyến bay tới Leh (3.524m), nhận phòng nghỉ ngơi thích nghi áp suất.' }
    ],
    included: 'Xe SUV chuyên dụng suốt tuyến; Khách sạn 3-4 sao có sưởi ấm; Các bữa ăn; Giấy phép biên giới ILP; Hướng dẫn viên & bình oxy y tế.',
    excluded: 'Vé máy bay quốc tế & nội địa; Visa Ấn Độ; Tiền tip lái xe; Chi phí cá nhân.',
    terms: 'Du khách cần có sức khỏe bình thường, không mắc bệnh tim mạch cấp.',
    status: 'published',
    metaTitle: '',
    metaDescription: ''
  });

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [autoSlug, setAutoSlug] = useState(!isEditing);

  // Modal State
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState('featuredImage'); // 'featuredImage' or 'gallery'

  useEffect(() => {
    if (isEditing) {
      loadTour();
    }
  }, [tourId]);

  async function loadTour() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tours/${tourId}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const item = data.data;
        
        let parsedGallery = [];
        try { parsedGallery = typeof item.gallery === 'string' ? JSON.parse(item.gallery) : (item.gallery || []); } catch (e) {}

        let parsedHighlights = [''];
        try { parsedHighlights = typeof item.highlights === 'string' ? JSON.parse(item.highlights) : (item.highlights || ['']); } catch (e) {}

        let parsedItinerary = [];
        try { parsedItinerary = typeof item.itinerary === 'string' ? JSON.parse(item.itinerary) : (item.itinerary || []); } catch (e) {}

        setFormData({
          title: item.title || '',
          slug: item.slug || '',
          price: item.price || 0,
          originalPrice: item.originalPrice || 0,
          isFeatured: item.isFeatured ? 1 : 0,
          badge: item.badge || '',
          durationDays: item.durationDays || 1,
          durationNights: item.durationNights || 0,
          departureLocation: item.departureLocation || 'Leh (Ấn Độ)',
          transportation: item.transportation || 'SUV 4x4',
          featuredImage: item.featuredImage || '',
          gallery: parsedGallery,
          overview: item.overview || '',
          highlights: parsedHighlights.length ? parsedHighlights : [''],
          itinerary: parsedItinerary.length ? parsedItinerary : [{ day: 1, title: '', content: '' }],
          included: item.included || '',
          excluded: item.excluded || '',
          terms: item.terms || '',
          status: item.status || 'published',
          metaTitle: item.metaTitle || '',
          metaDescription: item.metaDescription || ''
        });
        setAutoSlug(false);
      } else {
        setMessage({ type: 'error', text: 'Không tải được thông tin tour' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ' });
    } finally {
      setLoading(false);
    }
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      title: val,
      slug: autoSlug ? slugify(val) : prev.slug,
      metaTitle: prev.metaTitle === prev.title || !prev.metaTitle ? val : prev.metaTitle
    }));
  }

  // Highlights handlers
  function addHighlight() {
    setFormData(prev => ({ ...prev, highlights: [...prev.highlights, ''] }));
  }
  function updateHighlight(index, val) {
    setFormData(prev => {
      const arr = [...prev.highlights];
      arr[index] = val;
      return { ...prev, highlights: arr };
    });
  }
  function removeHighlight(index) {
    setFormData(prev => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index)
    }));
  }

  // Itinerary handlers
  function addItineraryDay() {
    setFormData(prev => ({
      ...prev,
      itinerary: [
        ...prev.itinerary,
        { day: prev.itinerary.length + 1, title: '', content: '' }
      ]
    }));
  }
  function updateItineraryDay(index, field, val) {
    setFormData(prev => {
      const arr = [...prev.itinerary];
      arr[index] = { ...arr[index], [field]: val };
      return { ...prev, itinerary: arr };
    });
  }
  function removeItineraryDay(index) {
    setFormData(prev => {
      const filtered = prev.itinerary.filter((_, i) => i !== index);
      const reindexed = filtered.map((d, i) => ({ ...d, day: i + 1 }));
      return { ...prev, itinerary: reindexed };
    });
  }

  function handleSelectMedia(urlOrItem) {
    const url = typeof urlOrItem === 'string' ? urlOrItem : (urlOrItem?.url || urlOrItem?.src || '');
    if (!url) return;
    if (mediaTarget === 'featuredImage') {
      setFormData(prev => ({ ...prev, featuredImage: url }));
    } else if (mediaTarget === 'gallery') {
      setFormData(prev => ({
        ...prev,
        gallery: Array.from(new Set([...prev.gallery, url]))
      }));
    }
  }

  function removeGalleryImage(url) {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter(item => item !== url)
    }));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tên tour');
      return;
    }
    if (!formData.slug.trim()) {
      alert('Vui lòng nhập đường dẫn slug');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const url = isEditing ? `/api/admin/tours/${tourId}` : '/api/admin/tours';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: isEditing ? 'Cập nhật tour thành công!' : 'Tạo tour mới thành công!' });
        if (!isEditing && data.data?.id) {
          window.location.href = `/admin/tours/edit?id=${data.data.id}`;
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Lỗi khi lưu tour' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }}></div>
        Đang tải thông tin tour...
      </div>
    );
  }

  return (
    <div className="tour-editor-container">
      <style>{`
        .tour-editor-container { max-width: 1200px; margin: 0 auto; padding-bottom: 60px; font-family: 'Inter', sans-serif; }
        .tour-topbar { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 12px; }
        .tour-topbar-left { display: flex; align-items: center; gap: 12px; }
        .tour-back-btn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; display: flex; align-items: center; justify-content: center; color: #475569; text-decoration: none; transition: all .15s; }
        .tour-back-btn:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
        .tour-title-h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; }
        .tour-subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
        .tour-topbar-right { display: flex; align-items: center; gap: 10px; }
        .tour-btn-secondary { padding: 8px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all .15s; }
        .tour-btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
        .tour-btn-primary { padding: 9px 18px; border-radius: 8px; border: none; background: #d97706; color: #fff; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: background .15s; }
        .tour-btn-primary:hover { background: #b45309; }
        .tour-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .tour-layout-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
        @media (max-width: 960px) { .tour-layout-grid { grid-template-columns: 1fr; } }
        
        .tour-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 20px; }
        .tour-card-header { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        
        .tour-field { margin-bottom: 16px; }
        .tour-label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; }
        .tour-input { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #0f172a; background: #fff; outline: none; transition: border-color .15s; font-family: inherit; }
        .tour-input:focus { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.12); }
        .tour-textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #0f172a; background: #fff; outline: none; transition: border-color .15s; font-family: inherit; resize: vertical; line-height: 1.5; }
        .tour-textarea:focus { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.12); }
        
        .tour-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .tour-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 640px) { .tour-grid-4 { grid-template-columns: 1fr 1fr; } }
        
        .itinerary-day-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
        .itinerary-day-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .badge-day { background: #d97706; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; white-space: nowrap; }
        
        .highlight-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .highlight-idx { width: 22px; height: 22px; border-radius: 50%; background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        .featured-dropzone { border: 2px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; padding: 24px 16px; text-align: center; cursor: pointer; transition: all .15s; }
        .featured-dropzone:hover { border-color: #d97706; background: #fffbeb; }
        
        .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
        .gallery-thumb { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-thumb button { position: absolute; top: 4px; right: 4px; background: rgba(220, 38, 38, 0.85); color: #fff; border: none; border-radius: 4px; padding: 4px; cursor: pointer; opacity: 0; transition: opacity .15s; }
        .gallery-thumb:hover button { opacity: 1; }
        
        .alert-box { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
        .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
        .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
      `}</style>

      {/* TOP BAR / ACTIONS */}
      <div className="tour-topbar">
        <div className="tour-topbar-left">
          <a href="/admin/tours" className="tour-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="tour-title-h1">
              {isEditing ? 'Chỉnh Sửa Tour Ladakh' : 'Tạo Tour Mới'}
            </h1>
            <p className="tour-subtitle">
              {isEditing ? `Mã Tour: ${tourId}` : 'Cấu hình chi tiết lịch trình, bảng giá, điểm nổi bật và chính sách tour'}
            </p>
          </div>
        </div>

        <div className="tour-topbar-right">
          {isEditing && formData.slug && (
            <a
              href={`/tour/${formData.slug}`}
              target="_blank"
              rel="noreferrer"
              className="tour-btn-secondary"
            >
              <Eye className="w-4 h-4 text-amber-600" />
              <span>Xem Public</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="tour-btn-primary"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang Lưu...' : 'Lưu Tour'}</span>
          </button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div className={`alert-box ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span style={{ fontWeight: 600 }}>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Đóng</button>
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="tour-layout-grid">
        {/* LEFT COLUMN: CORE INFO & ITINERARY */}
        <div>
          {/* BASIC INFORMATION */}
          <div className="tour-card">
            <div className="tour-card-header">Thông Tin Cơ Bản</div>

            <div className="tour-field">
              <label className="tour-label">
                Tên Tour Du Lịch <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Ví dụ: Ladakh Huyền Bí: Tiểu Tây Tạng & Đèo Khardung La (7 Ngày 6 Đêm)"
                className="tour-input"
                style={{ fontSize: '15px', fontWeight: 600 }}
              />
            </div>

            <div className="tour-grid-2">
              <div className="tour-field">
                <label className="tour-label">
                  Đường Dẫn Slug <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px 10px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginRight: '4px' }}>/tour/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      setFormData(prev => ({ ...prev, slug: slugify(e.target.value) }));
                    }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#b45309', fontWeight: 500 }}
                  />
                </div>
              </div>

              <div className="tour-field">
                <label className="tour-label">Huy Hiệu (Badge)</label>
                <input
                  type="text"
                  value={formData.badge}
                  onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                  placeholder="Ví dụ: Bán Chạy Nhất, Khuyên Dùng..."
                  className="tour-input"
                />
              </div>
            </div>

            {/* DURATION & LOGISTICS */}
            <div className="tour-grid-4">
              <div className="tour-field">
                <label className="tour-label">Số Ngày</label>
                <input
                  type="number"
                  min="1"
                  value={formData.durationDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                  className="tour-input"
                />
              </div>
              <div className="tour-field">
                <label className="tour-label">Số Đêm</label>
                <input
                  type="number"
                  min="0"
                  value={formData.durationNights}
                  onChange={(e) => setFormData(prev => ({ ...prev, durationNights: Number(e.target.value) }))}
                  className="tour-input"
                />
              </div>
              <div className="tour-field">
                <label className="tour-label">Điểm Đón / Khởi Hành</label>
                <input
                  type="text"
                  value={formData.departureLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, departureLocation: e.target.value }))}
                  placeholder="Leh (Ấn Độ)"
                  className="tour-input"
                />
              </div>
              <div className="tour-field">
                <label className="tour-label">Phương Tiện</label>
                <input
                  type="text"
                  value={formData.transportation}
                  onChange={(e) => setFormData(prev => ({ ...prev, transportation: e.target.value }))}
                  placeholder="SUV 4x4"
                  className="tour-input"
                />
              </div>
            </div>

            {/* OVERVIEW */}
            <div className="tour-field mb-0">
              <label className="tour-label">Tổng Quan Chuyến Đi (Overview)</label>
              <textarea
                rows={3}
                value={formData.overview}
                onChange={(e) => setFormData(prev => ({ ...prev, overview: e.target.value }))}
                placeholder="Tóm tắt nội dung đặc sắc của tour, thích hợp với ai..."
                className="tour-textarea"
              />
            </div>
          </div>

          {/* HIGHLIGHTS */}
          <div className="tour-card">
            <div className="tour-card-header">
              <span>Điểm Nhấn Nổi Bật (Highlights)</span>
              <button
                type="button"
                onClick={addHighlight}
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Điểm Nhấn
              </button>
            </div>

            {formData.highlights.map((hl, idx) => (
              <div key={idx} className="highlight-item">
                <span className="highlight-idx">{idx + 1}</span>
                <input
                  type="text"
                  value={hl}
                  onChange={(e) => updateHighlight(idx, e.target.value)}
                  placeholder="Ví dụ: Chinh phục đèo Khardung La 5.359m..."
                  className="tour-input"
                  style={{ flex: 1 }}
                />
                {formData.highlights.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHighlight(idx)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ITINERARY BUILDER */}
          <div className="tour-card">
            <div className="tour-card-header">
              <div>
                <span>Lịch Trình Chi Tiết Từng Ngày (Itinerary)</span>
              </div>
              <button
                type="button"
                onClick={addItineraryDay}
                className="tour-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Ngày Mới</span>
              </button>
            </div>

            {formData.itinerary.map((item, idx) => (
              <div key={idx} className="itinerary-day-box">
                <div className="itinerary-day-top">
                  <span className="badge-day">Ngày {item.day || idx + 1}</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItineraryDay(idx, 'title', e.target.value)}
                    placeholder="Tiêu đề chặng trong ngày (Ví dụ: Leh - Khardung La - Nubra Valley)"
                    className="tour-input"
                    style={{ fontWeight: 600 }}
                  />
                  {formData.itinerary.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItineraryDay(idx)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={item.content}
                  onChange={(e) => updateItineraryDay(idx, 'content', e.target.value)}
                  placeholder="Mô tả các hoạt động, điểm tham quan, ẩm thực, lưu ý trong ngày..."
                  className="tour-textarea"
                />
              </div>
            ))}
          </div>

          {/* INCLUSIONS & EXCLUSIONS */}
          <div className="tour-grid-2">
            <div className="tour-card" style={{ borderLeft: '4px solid #10b981' }}>
              <label className="tour-label" style={{ color: '#047857', fontWeight: 700 }}>
                Dịch Vụ Bao Gồm (Inclusions)
              </label>
              <textarea
                rows={4}
                value={formData.included}
                onChange={(e) => setFormData(prev => ({ ...prev, included: e.target.value }))}
                placeholder="Xe SUV, Khách sạn, Các bữa ăn, Giấy phép ILP..."
                className="tour-textarea"
              />
            </div>

            <div className="tour-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <label className="tour-label" style={{ color: '#b91c1c', fontWeight: 700 }}>
                Không Bao Gồm (Exclusions)
              </label>
              <textarea
                rows={4}
                value={formData.excluded}
                onChange={(e) => setFormData(prev => ({ ...prev, excluded: e.target.value }))}
                placeholder="Vé máy bay, Tip HDV, Nhu cầu cá nhân..."
                className="tour-textarea"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PRICING, MEDIA, PUBLISH */}
        <div>
          {/* PRICING & STATUS */}
          <div className="tour-card">
            <div className="tour-card-header">Giá Bán & Xuất Bản</div>

            <div className="tour-field">
              <label className="tour-label">
                Giá Bán Thực Tế (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                step="100000"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                className="tour-input"
                style={{ fontSize: '16px', fontWeight: 700, color: '#d97706' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formData.price || 0)}
              </span>
            </div>

            <div className="tour-field">
              <label className="tour-label">Giá Niêm Yết Cũ (VNĐ)</label>
              <input
                type="number"
                step="100000"
                value={formData.originalPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: Number(e.target.value) }))}
                className="tour-input"
                style={{ color: '#64748b' }}
              />
            </div>

            <div className="tour-field">
              <label className="tour-label">Trạng Thái Tour</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="tour-input"
              >
                <option value="published">Đã Xuất Bản (Hiện trên web)</option>
                <option value="draft">Bản Nháp (Ẩn)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                id="isFeaturedTour"
                checked={Boolean(formData.isFeatured)}
                onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked ? 1 : 0 }))}
                style={{ width: '16px', height: '16px', accentColor: '#d97706', cursor: 'pointer' }}
              />
              <label htmlFor="isFeaturedTour" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Đánh dấu là Tour Nổi Bật (Featured)
              </label>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="tour-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>

          {/* FEATURED IMAGE */}
          <div className="tour-card">
            <div className="tour-card-header">
              <span>Ảnh Đại Diện Tour</span>
              {formData.featuredImage && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, featuredImage: '' }))}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Trash2 className="w-3 h-3" />
                  Xóa
                </button>
              )}
            </div>

            {formData.featuredImage ? (
              <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <img
                  src={formData.featuredImage}
                  alt="Tour Thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setMediaTarget('featuredImage');
                    setMediaModalOpen(true);
                  }}
                  style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(15,23,42,0.75)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Thay Đổi Ảnh
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setMediaTarget('featuredImage');
                  setMediaModalOpen(true);
                }}
                className="featured-dropzone"
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#64748b' }}>
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Chọn ảnh bìa từ Thư Viện Media</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Định dạng WebP/JPG sắc nét</div>
              </div>
            )}
          </div>

          {/* GALLERY IMAGES */}
          <div className="tour-card">
            <div className="tour-card-header">
              <span>Thư Viện Ảnh (Gallery)</span>
              <button
                type="button"
                onClick={() => {
                  setMediaTarget('gallery');
                  setMediaModalOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Ảnh
              </button>
            </div>

            {formData.gallery.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>Chưa có ảnh trong gallery</p>
            ) : (
              <div className="gallery-grid">
                {formData.gallery.map((url, i) => (
                  <div key={i} className="gallery-thumb">
                    <img src={url} alt="Gallery" />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(url)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MEDIA PICKER MODAL */}
      <MediaPickerModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleSelectMedia}
        initialSearch=""
      />
    </div>
  );
}
