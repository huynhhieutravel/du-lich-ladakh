import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';

interface MediaItem {
  id: number;
  src: string;
  name: string;
  size: string;
  dim: string;
  displayDate: string;
  alt: string;
  title: string;
  caption: string;
  desc: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, item?: MediaItem) => void;
  initialSearch?: string;
}

export default function MediaPickerModal({ isOpen, onClose, onSelect, initialSearch = '' }: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initSearch = initialSearch || '';
      setSearchTerm(initSearch);
      setMediaList([]);
      setPage(1);
      setHasMore(true);
      fetchMedia(1, initSearch, true);
    } else {
      setSelectedItem(null);
      setSaveStatusMsg('');
    }
  }, [isOpen, initialSearch]);

  useEffect(() => {
    if (isOpen && activeTab === 'library') {
      const timer = setTimeout(() => {
        // Prevent double fetching on initial open if search term hasn't changed from initial
        fetchMedia(1, searchTerm, false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, activeTab]);

  const fetchMedia = async (pageNum: number, searchOverride?: string, isInitial?: boolean) => {
    const currentSearch = isInitial ? (searchOverride ?? '') : searchTerm;
    
    if (pageNum === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const res = await fetch(`/api/admin/media?page=${pageNum}&limit=40&search=${encodeURIComponent(currentSearch)}`);
      const resData = await res.json();
      if (res.ok && resData.success && resData.data) {
        const data = resData.data;
        if (pageNum === 1) {
          setMediaList(data.media || []);
        } else {
          setMediaList(prev => [...prev, ...(data.media || [])]);
        }
        setTotalCount(data.pagination?.total || 0);
        setHasMore(pageNum < (data.pagination?.totalPages || 1));
        setPage(pageNum);
      } else {
        console.error('Failed to fetch media:', resData.error?.message);
      }
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchMedia(page + 1);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  function extractExifString(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      if (typeof val.value === 'string') return val.value.trim();
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0];
        return typeof first === 'string' ? first.trim() : (first?.value || '');
      }
    }
    return String(val).trim();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    setIsUploading(true);
    let fileToUpload = originalFile;
    let meta = { title: '', altText: '', caption: '', description: '' };

    // 1. Extract EXIF / IPTC / XMP metadata from original raw file before compression
    try {
      let exifrLib: any = (window as any).exifr;
      if (!exifrLib) {
        const mod = await import('exifr');
        exifrLib = mod.default || mod;
      }
      if (exifrLib?.parse) {
        const parsed = await exifrLib.parse(originalFile, {
          iptc: true,
          xmp: true,
          tiff: true,
          exif: true,
          jfif: true
        });
        if (parsed) {
          const exifTitle = extractExifString(parsed.title) || extractExifString(parsed.ObjectName) || '';
          const exifDesc = extractExifString(parsed.description) || extractExifString(parsed.ImageDescription) || extractExifString(parsed.Caption) || '';
          
          const rawFileName = originalFile.name.split('.').slice(0, -1).join('.') || originalFile.name;
          meta = {
            title: exifTitle || rawFileName,
            altText: exifDesc || exifTitle || rawFileName,
            caption: exifDesc || '',
            description: exifTitle || ''
          };
        }
      }
    } catch (exifErr) {
      console.warn('Could not parse EXIF in MediaPickerModal', exifErr);
    }

    if (!meta.title) {
      const rawFileName = originalFile.name.split('.').slice(0, -1).join('.') || originalFile.name;
      meta = {
        title: rawFileName,
        altText: rawFileName,
        caption: '',
        description: rawFileName
      };
    }

    // 2. Compress if image
    if (originalFile.type.startsWith('image/') && originalFile.type !== 'image/gif' && originalFile.type !== 'image/svg+xml') {
      try {
        const compressedBlob = await imageCompression(originalFile, {
          maxSizeMB: 10,
          maxWidthOrHeight: 2500,
          useWebWorker: false,
          initialQuality: 0.90,
          fileType: 'image/webp'
        });
        const newName = originalFile.name.replace(/\.[^/.]+$/, ".webp");
        fileToUpload = new File([compressedBlob], newName, { type: 'image/webp' });
      } catch (error) {
        console.error('Compression error:', error);
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (meta.title) formData.append('title', meta.title);
    if (meta.altText) formData.append('altText', meta.altText);
    if (meta.caption) formData.append('caption', meta.caption);
    if (meta.description) formData.append('description', meta.description);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const resData = await res.json();
      
      if (res.ok && resData.success && resData.data) {
        const data = resData.data;
        // Upload successful, switch back to library tab and refresh
        setActiveTab('library');
        await fetchMedia(1);
        
        // Auto-select the newly uploaded file by matching the URL
        const newlyUploaded = mediaList.find(m => m.src === data.url) || null;
        if (!newlyUploaded) {
            // If it's not yet in the list (race condition), just set it as a dummy item to be selected
            setSelectedItem({
                id: data.id || Date.now(),
                src: data.url,
                name: fileToUpload.name,
                size: (fileToUpload.size / 1024).toFixed(1) + ' KB',
                dim: '',
                displayDate: 'Just now',
                alt: data.altText || meta.altText,
                title: data.title || meta.title,
                caption: data.caption || meta.caption,
                desc: data.description || meta.description
            });
        }
      } else {
        (window as any).AppModal?.alert(resData.error?.message || 'Lỗi tải ảnh lên');
      }
    } catch (err) {
      console.error('Upload error:', err);
      (window as any).AppModal?.alert('Lỗi kết nối khi tải ảnh');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMetadataChange = (field: keyof MediaItem, value: string) => {
    if (selectedItem) {
      setSelectedItem({ ...selectedItem, [field]: value });
      setMediaList(prev => prev.map(m => m.id === selectedItem.id ? { ...m, [field]: value } : m));
    }
  };

  const saveMetadata = async () => {
    if (!selectedItem) return;
    setIsSavingMetadata(true);
    setSaveStatusMsg('');
    try {
      const res = await fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedItem.id,
          altText: selectedItem.alt,
          title: selectedItem.title,
          caption: selectedItem.caption,
          description: selectedItem.desc
        })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setSaveStatusMsg('✓ Đã lưu');
        setTimeout(() => setSaveStatusMsg(''), 2000);
      } else {
        setSaveStatusMsg('✗ Lỗi khi lưu');
      }
    } catch (err) {
      console.error(err);
      setSaveStatusMsg('✗ Lỗi mạng');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleInsert = () => {
    if (selectedItem) {
      onSelect(selectedItem.src, selectedItem);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 10000, 
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '95vw', maxWidth: '1400px', 
        height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e2e8f0', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0f172a' }}>Thư viện Media</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b'
          }}>&times;</button>
        </div>

        {/* Tabs and Search */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <button 
              onClick={() => setActiveTab('upload')}
              style={{
                padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '15px', fontWeight: activeTab === 'upload' ? 600 : 400,
                color: activeTab === 'upload' ? '#2563eb' : '#64748b',
                borderBottom: activeTab === 'upload' ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              Tải lên tệp mới
            </button>
            <button 
              onClick={() => setActiveTab('library')}
              style={{
                padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '15px', fontWeight: activeTab === 'library' ? 600 : 400,
                color: activeTab === 'library' ? '#2563eb' : '#64748b',
                borderBottom: activeTab === 'library' ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              Media Library
            </button>
          </div>
          {activeTab === 'library' && (
            <div>
              <input 
                type="text" 
                placeholder="Tìm kiếm tệp media..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', 
                  width: '250px', outline: 'none'
                }} 
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', position: 'relative' }}>
          
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
              <div style={{ 
                border: '2px dashed #cbd5e1', borderRadius: '12px', width: '100%', maxWidth: '600px', 
                padding: '60px 20px', textAlign: 'center', background: '#fff' 
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>☁️</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Kéo thả tệp vào đây</h3>
                <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px' }}>hoặc</p>
                <button 
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  style={{
                    padding: '10px 24px', background: isUploading ? '#94a3b8' : '#2563eb', color: '#fff', 
                    border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUploading ? 'Đang tải lên...' : 'Chọn tệp'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div style={{ padding: '20px', display: 'flex', height: '100%' }}>
              {/* Grid */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', alignContent: 'start', overflowY: 'auto', paddingRight: '16px' }}>
                {isLoading ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải danh sách...</div>
                ) : mediaList.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>Chưa có hình ảnh nào.</div>
                ) : (
                  mediaList.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      style={{
                        position: 'relative', width: '100%', paddingBottom: '100%', borderRadius: '8px', overflow: 'hidden',
                        cursor: 'pointer', border: selectedItem?.id === item.id ? '3px solid #2563eb' : '1px solid #e2e8f0',
                        boxShadow: selectedItem?.id === item.id ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      <img src={item.src} alt={item.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      {selectedItem?.id === item.id && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#2563eb', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>✓</div>
                      )}
                    </div>
                  ))
                )}
                
                {/* Load More Section */}
                {mediaList.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                      Đang hiển thị {mediaList.length} của {totalCount} file media
                    </div>
                    {hasMore && (
                      <button 
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        style={{
                          padding: '8px 24px', background: isLoadingMore ? '#e2e8f0' : '#f8fafc', 
                          color: isLoadingMore ? '#94a3b8' : '#334155', border: '1px solid #cbd5e1', 
                          borderRadius: '6px', fontSize: '13px', fontWeight: 600, 
                          cursor: isLoadingMore ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isLoadingMore ? 'Đang tải...' : 'Tải thêm'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Sidebar */}
              <div style={{ width: '380px', flexShrink: 0, borderLeft: '1px solid #e2e8f0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Chi tiết đính kèm</h3>
                {selectedItem ? (
                  <div>
                    <img src={selectedItem.src} alt={selectedItem.name} style={{ width: '100%', borderRadius: '6px', marginBottom: '12px', border: '1px solid #e2e8f0' }} />
                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, wordBreak: 'break-all', marginBottom: '4px' }}>{selectedItem.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{selectedItem.displayDate}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>{selectedItem.size} {selectedItem.dim ? `- ${selectedItem.dim}` : ''}</div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Copy Link</label>
                      <input type="text" readOnly value={selectedItem.src} style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#64748b', boxSizing: 'border-box' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
                    </div>

                    <div style={{ height: '1px', background: '#e2e8f0', margin: '20px 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Tiêu đề</label>
                        <input type="text" value={selectedItem.title} onChange={(e) => handleMetadataChange('title', e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Mô tả SEO (Alt Text)</label>
                        <input type="text" value={selectedItem.alt} onChange={(e) => handleMetadataChange('alt', e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Chú thích (Caption)</label>
                        <textarea value={selectedItem.caption} onChange={(e) => handleMetadataChange('caption', e.target.value)} rows={3} style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Miêu tả (Description)</label>
                        <textarea value={selectedItem.desc} onChange={(e) => handleMetadataChange('desc', e.target.value)} rows={3} style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <button 
                          onClick={saveMetadata}
                          disabled={isSavingMetadata}
                          style={{
                            padding: '8px 16px', background: isSavingMetadata ? '#94a3b8' : '#2563eb', color: '#fff', 
                            border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: isSavingMetadata ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isSavingMetadata ? 'Đang lưu...' : 'Lưu thông tin'}
                        </button>
                        {saveStatusMsg && <span style={{ fontSize: '13px', color: saveStatusMsg.includes('✓') ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{saveStatusMsg}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Chưa chọn mục nào</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fff',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
        }}>
          <button 
            onClick={handleInsert}
            disabled={!selectedItem && activeTab === 'library'}
            style={{
              padding: '10px 24px', background: (!selectedItem && activeTab === 'library') ? '#94a3b8' : '#2563eb', 
              color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, 
              cursor: (!selectedItem && activeTab === 'library') ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Chèn ảnh
          </button>
        </div>

      </div>
    </div>
  );
}
