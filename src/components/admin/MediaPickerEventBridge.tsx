import React, { useState, useEffect } from 'react';
import MediaPickerModal from './MediaPickerModal';

export default function MediaPickerEventBridge() {
  const [isOpen, setIsOpen] = useState(false);
  const [targetInputId, setTargetInputId] = useState<string | null>(null);
  const [targetPreviewId, setTargetPreviewId] = useState<string | null>(null);
  const [targetPlaceholderId, setTargetPlaceholderId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail) {
        setTargetInputId(e.detail.inputId || null);
        setTargetPreviewId(e.detail.previewId || null);
        setTargetPlaceholderId(e.detail.placeholderId || null);
      }
      setIsOpen(true);
    };

    window.addEventListener('open-media-picker', handleOpen);
    return () => window.removeEventListener('open-media-picker', handleOpen);
  }, []);

  const handleSelect = (url: string) => {
    if (targetInputId) {
      const input = document.getElementById(targetInputId) as HTMLInputElement;
      if (input) {
        input.value = url;
        // Trigger input event to update React/Alpine states if any
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (targetPreviewId) {
      const img = document.getElementById(targetPreviewId) as HTMLImageElement;
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }
    }

    if (targetPlaceholderId) {
      const placeholder = document.getElementById(targetPlaceholderId);
      if (placeholder) {
        placeholder.style.display = 'none';
      }
    }

    setIsOpen(false);
  };

  return (
    <MediaPickerModal 
      isOpen={isOpen} 
      onClose={() => setIsOpen(false)} 
      onSelect={handleSelect} 
    />
  );
}
