import React, { useCallback, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import MediaPickerModal from '../MediaPickerModal';

/**
 * React NodeView for the MediaCard block.
 * Renders a bordered card: image left (33%) | editable text right (67%)
 */
export function MediaCardView(props: any) {
  const { node, updateAttributes, deleteNode } = props;
  const { src, alt } = node.attrs;

  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const handleImageUpload = useCallback(() => {
    setIsMediaModalOpen(true);
  }, []);

  const handleMediaSelected = useCallback((url: string) => {
    updateAttributes({ src: url });
  }, [updateAttributes]);

  const handleImageUrl = useCallback(async () => {
    const url = await (window as any).AppModal.prompt('Nhập đường dẫn ảnh (Image URL):');
    if (url !== null && url.trim() !== '') {
      updateAttributes({ src: url });
    }
  }, [src, updateAttributes]);

  return (
    <NodeViewWrapper>
      <MediaPickerModal 
        isOpen={isMediaModalOpen} 
        onClose={() => setIsMediaModalOpen(false)} 
        onSelect={handleMediaSelected} 
      />
      <div
        style={{
          display: 'flex',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          overflow: 'hidden',
          margin: '16px 0',
          background: '#fff',
          minHeight: '120px',
        }}
        data-type="media-card"
      >
        {/* Left: Image area (33%) */}
        <div
          style={{
            width: '33.33%',
            flexShrink: 0,
            position: 'relative',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          contentEditable={false}
        >
          {src ? (
            <img
              src={src}
              alt={alt || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onClick={handleImageUpload}
              title="Click to change image"
            />
          ) : (
            <div
              onClick={handleImageUpload}
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>🖼</div>
              <div>Click to add image</div>
            </div>
          )}
          {/* Small toolbar for image */}
          {src && (
            <div
              style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                display: 'flex',
                gap: '4px',
              }}
            >
              <button
                onClick={handleImageUpload}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                📷
              </button>
              <button
                onClick={handleImageUrl}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                🔗
              </button>
            </div>
          )}
        </div>

        {/* Right: Text area (67%) */}
        <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
          <NodeViewContent style={{ outline: 'none' }} />
        </div>

        {/* Delete button */}
        <button
          onClick={deleteNode}
          contentEditable={false}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'rgba(239,68,68,0.9)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: '1',
          }}
          className="mc-delete"
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}
