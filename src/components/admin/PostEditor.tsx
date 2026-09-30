import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { FloatingMenu, BubbleMenu } from '@tiptap/react/menus';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { AlignableImage } from './extensions/AlignableImage';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Youtube } from '@tiptap/extension-youtube';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Iframe } from './extensions/Iframe';
import { MediaCard } from './extensions/MediaCard';
import { FaqBlock } from './extensions/FaqBlock';
import imageCompression from 'browser-image-compression';
import { WpGallery } from './extensions/WpGallery';
import MediaPickerModal from './MediaPickerModal';
import slugify from 'slugify';
import './PostEditor.css';

const getSeoColor = (length: number, min: number, max: number) => {
  if (length === 0) return '#e2e8f0';
  if (length < min) return '#f59e0b';
  if (length <= max) return '#10b981';
  return '#ef4444';
};

const SeoProgressBar = ({ length, min, max, maxDisplay = 100 }: { length: number, min: number, max: number, maxDisplay?: number }) => {
  const percentage = Math.min((length / maxDisplay) * 100, 100);
  const color = getSeoColor(length, min, max);
  return (
    <div style={{display: 'flex', gap: '2px', width: '120px', height: '6px', marginLeft: '10px'}}>
      {[0, 20, 40, 60, 80].map(threshold => (
        <div key={threshold} style={{flex: 1, background: percentage > threshold ? color : '#e2e8f0', borderRadius: '1px'}} />
      ))}
    </div>
  );
};

interface PostEditorProps {
  initialPostId?: string | null;
}

const COMMON_LOCATIONS = [
  "Thị trấn Leh (3.524m)", "Đèo Khardung La (5.359m)", "Thung lũng Nubra", 
  "Cồn cát Hunder", "Làng Turtuk (biên giới Balti)", "Hồ Pangong Tso (4.250m)", 
  "Hồ Tso Moriri (4.522m)", "Tu viện Thiksey", "Tu viện Hemis", "Tu viện Diskit",
  "Đồi từ tính Magnetic Hill", "Ngã ba sông Sangam (Indus - Zanskar)", "Đèo Chang La (5.360m)",
  "Làng Hanle & Dark Sky Reserve", "Srinagar, Kashmir", "Sonamarg, Kashmir"
];

export default function PostEditor({ initialPostId }: PostEditorProps) {
  const [postId, setPostId] = useState<string | null>(initialPostId || null);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(!initialPostId);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [isPublishedOriginally, setIsPublishedOriginally] = useState(false);
  const [status, setStatus] = useState('draft');
  const [featuredImage, setFeaturedImage] = useState('');
  
  const [categories, setCategories] = useState<any[]>([]); 
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [authorId, setAuthorId] = useState<string>('');
  const [authorList, setAuthorList] = useState<any[]>([]);
  
  // Post settings
  const [format, setFormat] = useState('standard');
  const [isSticky, setIsSticky] = useState(false);
  const [isElementor, setIsElementor] = useState(false);
  const [showTiptapConfirm, setShowTiptapConfirm] = useState(false);
  const [editorMode, setEditorMode] = useState<'tiptap' | 'raw'>('tiptap');
  const [rawHtml, setRawHtml] = useState('');
  const [extractedImages, setExtractedImages] = useState<{url: string, alt: string}[]>([]);
  
  // SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [noindex, setNoindex] = useState(false);
  const [nofollow, setNofollow] = useState(false);
  const [customSchema, setCustomSchema] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [isSeoModalOpen, setIsSeoModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaModalTarget, setMediaModalTarget] = useState<'image' | 'featured'>('image');
  const [editingImageNodePos, setEditingImageNodePos] = useState<number | null>(null);
  const [mediaInitialSearch, setMediaInitialSearch] = useState('');

  // UI State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [draftSnapshot, setDraftSnapshot] = useState<any>(null);
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [editorUpdateTick, setEditorUpdateTick] = useState(0);
  // Link Edit State
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState('');
  const [activeLinkUrl, setActiveLinkUrl] = useState('');

  // Revisions / Changelog & Concurrency Lock
  const isSavingRef = useRef<boolean>(false);
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);
  const [revisionsList, setRevisionsList] = useState<any[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const [isLoadingRevDetail, setIsLoadingRevDetail] = useState(false);


  // Auto-resize title textarea
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
    }
  }, [title]);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Dirty check
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // FIX: Stale Closure Trap with Tiptap
  // Tiptap's useEditor only evaluates onUpdate ONCE on mount.
  // We need a ref to always point to the latest triggerAutosave function.
  const triggerAutosaveRef = useRef<() => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 100 }, 
      }),
      Placeholder.configure({
        placeholder: 'Bắt đầu viết nội dung bài viết...',
      }),
      AlignableImage.configure({
        HTMLAttributes: { class: 'editor-image' },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ inline: false }),
      WpGallery,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Iframe,
      MediaCard,
      FaqBlock,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      triggerAutosaveRef.current();
      setEditorUpdateTick(t => t + 1);
    },
    editorProps: {
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === 'A' || target.closest('a')) {
            event.preventDefault();
            // Let the event propagate so BubbleMenu can still appear, but don't let browser open it
            return false;
          }
          return false;
        }
      }
    }
  });

  // Sync active link URL for the BubbleMenu
  useEffect(() => {
    if (!editor) return;
    const updateLinkUrl = () => {
      if (editor.isActive('link')) {
        const attrs = editor.getAttributes('link');
        let href = attrs?.href || '';
        
        // Fallback DOM extraction if Tiptap attributes are empty
        if (!href) {
          try {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              let node: Node | null = selection.getRangeAt(0).startContainer;
              while (node && node.nodeName !== 'DIV') {
                if (node.nodeName.toLowerCase() === 'a') {
                  const domHref = (node as HTMLAnchorElement).getAttribute('href');
                  if (domHref) href = domHref;
                }
                node = node.parentNode;
              }
            }
          } catch(e) {}
        }
        
        setActiveLinkUrl(href);
      } else {
        setActiveLinkUrl('');
      }
    };
    
    editor.on('selectionUpdate', updateLinkUrl);
    editor.on('transaction', updateLinkUrl);
    return () => {
      editor.off('selectionUpdate', updateLinkUrl);
      editor.off('transaction', updateLinkUrl);
    };
  }, [editor]);

  // AGGRESSIVE CLICK INTERCEPTOR (CAPTURING PHASE)
  // This guarantees that clicking links in the editor never opens a new tab natively or via Tiptap
  useEffect(() => {
    const originalWindowOpen = window.open;
    
    // Temporary override to block any Tiptap script from forcing window.open
    window.open = function(url?: string | URL | undefined, target?: string | undefined, features?: string | undefined) {
      const urlStr = typeof url === 'string' ? url : url?.toString() || '';
      // Allow Preview and non-editor navigation through
      if (urlStr.includes('preview-post') || urlStr.includes('/admin')) {
        return originalWindowOpen.call(window, url, target, features);
      }
      if (document.activeElement?.closest('.ProseMirror')) {
        return null;
      }
      return originalWindowOpen.call(window, url, target, features);
    };

    const blockLinkClicks = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only block if clicking inside the Prosemirror editor
      if (target.closest('.ProseMirror')) {
        if (target.tagName === 'A' || target.closest('a')) {
          e.preventDefault();
          e.stopPropagation(); // Stop Tiptap's click handler from ever seeing this!
        }
      }
    };
    
    // Use true for capturing phase to intercept before Tiptap or Browser
    document.addEventListener('click', blockLinkClicks, true);
    
    return () => {
      document.removeEventListener('click', blockLinkClicks, true);
      window.open = originalWindowOpen;
    };
  }, []);

  const [pendingJsonContent, setPendingJsonContent] = useState<any>(null);

  // Load Post Data
  useEffect(() => {
    if (postId) {
      fetch(`/api/admin/posts/${postId}`)
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.data) {
            const data = resData.data;
            setTitle(data.title || '');
            setSlug(data.slug || '');
            setIsSlugManual(true);
            setStatus(data.status || 'draft');
            if (data.status === 'published') setIsPublishedOriginally(true);
            setFeaturedImage(data.featuredImage || '');
            
            setCategoryIds(data.categoryIds || []);
            setTagIds(data.tagIds || []);
            
            setFormat(data.format || 'standard');
            setIsSticky(!!data.isSticky);
            setSeoTitle(data.seoTitle || '');
            setSeoDescription(data.seoDescription || '');
            setCanonicalUrl(data.canonicalUrl || '');
            setFocusKeyword(data.focusKeyword || '');
            setNoindex(!!data.noindex);
            setNofollow(!!data.nofollow);
            setCustomSchema(data.customSchema || '');
            if (data.customSchema) {
              try {
                const parsed = JSON.parse(data.customSchema);
                if (parsed.location) {
                  if (Array.isArray(parsed.location)) {
                    setLocations(parsed.location);
                  } else if (typeof parsed.location === 'string') {
                    setLocations(parsed.location.split(',').map((l: string) => l.trim()).filter(Boolean));
                  }
                }
              } catch (e) {}
            }
            setIsElementor(!!data.isElementor);
            setAuthorId(data.authorId || '');
            if (data.isElementor) {
              setEditorMode('raw');
            }
            
            // Detect HTML content: by contentFormat field OR by content starting with '<' (old WP posts have contentFormat=NULL)
            const contentStr = typeof data.content === 'string' ? data.content.trim() : '';
            const isHtmlContent = data.contentFormat === 'html' || data.isElementor || (contentStr.startsWith('<') && !contentStr.startsWith('{'));
            
            if (isHtmlContent) {
              setRawHtml(data.content || '');
              
              if (!data.isElementor) {
                // Heuristic: If it's a classic HTML post with complex elements, default to Raw Mode to protect it
                if (data.content && (data.content.includes('<div') || data.content.includes('class=') || data.content.includes('[snippet') || data.content.includes('<table'))) {
                  setEditorMode('raw');
                } else {
                  // Pass to pending to load into Tiptap when ready
                  setPendingJsonContent(data.content || '');
                }
              }
            } else if (data.content) {
              setPendingJsonContent(data.content);
            }
            
            if (data.draftSnapshot) {
              try { setDraftSnapshot(JSON.parse(data.draftSnapshot)); } catch (e) {}
            }
            setIsInitialFetchDone(true);
          }
        })
        .catch(() => setIsInitialFetchDone(true)); // Prevent permanent lock on error
    }
  }, [postId]);

  // Load pending JSON content into Tiptap when editor is ready
  useEffect(() => {
    if (editor && pendingJsonContent !== null) {
      let parsedContent = pendingJsonContent;
      if (typeof pendingJsonContent === 'string' && (pendingJsonContent.startsWith('{') || pendingJsonContent.startsWith('['))) {
        try { parsedContent = JSON.parse(pendingJsonContent); } catch (e) {}
      }
      
      editor.chain()
        .setContent(parsedContent, false)
        .command(({ tr }) => {
          tr.setMeta('addToHistory', false);
          return true;
        })
        .run();
        
      setPendingJsonContent(null); // Clear after loading
    }
  }, [editor, pendingJsonContent]);

  // Load Taxonomies
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/categories').then(res => res.ok ? res.json() : { data: [] }),
      fetch('/api/admin/tags').then(res => res.ok ? res.json() : { data: [] }),
      fetch('/api/admin/users').then(res => res.ok ? res.json() : { data: [] })
    ]).then(([catRes, tagRes, userRes]) => {
      const cats = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(cats);
      setTags(Array.isArray(tagRes.data) ? tagRes.data : []);
      setAuthorList(Array.isArray(userRes.data) ? userRes.data : []);

      // Auto-select category if in URL and this is a new post
      if (!initialPostId) {
        const urlParams = new URLSearchParams(window.location.search);
        const catSlug = urlParams.get('categorySlug');
        if (catSlug) {
          const cat = cats.find(c => c.slug === catSlug);
          if (cat) {
            setCategoryIds([String(cat.id)]);
          }
        }
      }
    });
  }, [initialPostId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Only auto-slug if it's not manually changed AND it was not originally published
    if (!isSlugManual && !isPublishedOriginally) {
      setSlug(slugify(newTitle, { lower: true, strict: true, locale: 'vi' }));
    }
    triggerAutosave();
  };

  const triggerAutosave = useCallback(() => {
    setIsDirty(true);
    setSaveStatus('saving');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (savePostRef.current) savePostRef.current(undefined, status === 'published');
    }, 10000);
  }, [status]);

  // Update the ref whenever triggerAutosave changes
  useEffect(() => {
    triggerAutosaveRef.current = triggerAutosave;
  }, [triggerAutosave]);

  const handleCategoryToggle = (id: string) => {
    setCategoryIds(prev => (prev || []).includes(id) ? (prev || []).filter(c => c !== id) : [...(prev || []), id]);
    triggerAutosave();
  };

  const handleTagToggle = (id: string) => {
    setTagIds(prev => (prev || []).includes(id) ? (prev || []).filter(t => t !== id) : [...(prev || []), id]);
    triggerAutosave();
  };

  const handleCreateTag = async () => {
    if (!tagSearchTerm.trim()) return;
    const confirm = await window.AppModal.confirm(`Bạn có chắc muốn tạo tag mới: "${tagSearchTerm.trim()}"?`);
    if (!confirm) return;
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagSearchTerm.trim() })
      });
      const resData = await res.json();
      if (res.ok && resData.success && resData.data?.id) {
        setTags(prev => [...prev, resData.data]);
        setTagIds(prev => [...(prev || []), resData.data.id]);
        setTagSearchTerm('');
        setIsTagDropdownOpen(false);
        triggerAutosave();
      } else {
        window.AppModal.alert(resData.error?.message || 'Failed to create tag');
      }
    } catch (err) {
      window.AppModal.alert('Network error while creating tag');
    }
  };

  const savePostRef = useRef<any>(null);

  const savePost = async (statusOverride?: string, isDraftSave: boolean = false) => {
    if (!isInitialFetchDone) return;
    if (isSavingRef.current) return;
    
    if (!title.trim() && (!editor || editor.isEmpty)) {
      setSaveStatus('idle');
      return; 
    }

    if (!isDraftSave && debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    const finalStatus = statusOverride || status;
    if (statusOverride) setStatus(statusOverride);

    let finalCustomSchema = customSchema;
    const isCorporateRetreat = categoryIds.some(id => {
      const cat = categories.find(c => String(c.id) === String(id));
      return cat && cat.slug === 'hanh-trinh-doanh-nghiep';
    });

    if (isCorporateRetreat) {
      try {
        const parsed = customSchema ? JSON.parse(customSchema) : {};
        if (locations.length > 0) parsed.location = locations.join(', ');
        else delete parsed.location;
        finalCustomSchema = JSON.stringify(parsed);
      } catch (e) {
        finalCustomSchema = JSON.stringify({ location: locations.join(', ') });
      }
    } else {
      if (customSchema) {
        try {
          JSON.parse(customSchema);
        } catch (e) {
          window.AppModal.alert("Lỗi: Mã Schema (Article) không hợp lệ. Vui lòng kiểm tra lại cú pháp JSON.");
          setSaveStatus('error');
          isSavingRef.current = false;
          return;
        }
      }
    }

    // Ensure astro-code overrides any editorMode inference
    const finalFormat = format === 'astro-code' ? 'astro-code' : (editorMode === 'raw' ? 'landing' : format);
    const finalIsElementor = format === 'astro-code' ? 0 : (editorMode === 'raw' ? 0 : (isElementor ? 1 : 0));

    const payload = {
      title,
      slug,
      categoryIds,
      tagIds,
      status: finalStatus,
      featuredImage,
      format: finalFormat,
      isSticky,
      seoTitle,
      seoDescription,
      canonicalUrl,
      focusKeyword,
      noindex,
      nofollow,
      customSchema: finalCustomSchema,
      isElementor: finalIsElementor,
      isDraftSave,
      contentFormat: editorMode === 'raw' ? 'html' : 'json',
      contentVersion: editorMode === 'raw' ? 2 : 3,
      content: editorMode === 'raw' ? rawHtml : (editor ? editor.getJSON() : {}),
      excerpt: seoDescription ? seoDescription : (editor ? editor.getText().substring(0, 150) + '...' : ''),
      authorId: authorId ? authorId : null
    };

    try {
      if (!postId) {
        const res = await fetch('/api/admin/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          if (!isDraftSave) window.AppModal.alert(resData.error?.message || 'Lỗi khi lưu bài viết');
          setSaveStatus('error');
          return;
        }
        if (resData.data?.id) {
          setPostId(resData.data.id);
          window.history.replaceState({}, '', `/admin/posts/edit?id=${resData.data.id}`);
        }
      } else {
        const res = await fetch(`/api/admin/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (!res.ok || !resData.success) {
          if (!isDraftSave) window.AppModal.alert(resData.error?.message || 'Lỗi khi cập nhật bài viết');
          setSaveStatus('error');
          return;
        }
        // Only show success notification on MANUAL save (not auto-save)
        if (!isDraftSave && typeof window.AppModal?.alert === 'function') {
          setDraftSnapshot(null);
          window.AppModal.alert('✅ Đã cập nhật bài viết thành công!');
        }
      }
      if (!isDraftSave) {
        setDraftSnapshot(null);
      }
      setSaveStatus('saved');
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (error) {
      if (!isDraftSave) window.AppModal.alert("Đã có lỗi xảy ra trong quá trình lưu bài viết. Vui lòng thử lại.");
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  };

  const loadRevisions = async () => {
    if (!postId) return;
    setIsLoadingRevisions(true);
    setSelectedRevision(null);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/revisions`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRevisionsList(data.data || []);
      } else {
        window.AppModal.alert(data.error?.message || 'Không thể tải danh sách phiên bản');
      }
    } catch (e) {
      window.AppModal.alert('Lỗi kết nối khi tải danh sách phiên bản');
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  const handleSelectRevision = async (revId: string) => {
    if (!postId || !revId) return;
    setIsLoadingRevDetail(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/revisions/${revId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedRevision(data.data);
      } else {
        window.AppModal.alert(data.error?.message || 'Không thể tải chi tiết phiên bản');
      }
    } catch (e) {
      window.AppModal.alert('Lỗi kết nối khi tải chi tiết phiên bản');
    } finally {
      setIsLoadingRevDetail(false);
    }
  };

  const handleRestoreRevision = async (rev: any) => {
    if (!rev) return;
    const formattedDate = new Date(rev.createdAt).toLocaleString('vi-VN');
    const confirm = await window.AppModal.confirm(
      `Bạn có chắc chắn muốn khôi phục bài viết về phiên bản lúc ${formattedDate}?\n\nToàn bộ nội dung trong trình soạn thảo sẽ được nạp lại theo phiên bản này để bạn kiểm tra trước khi lưu.`
    );
    if (!confirm) return;

    try {
      setTitle(rev.title || '');
      if (rev.slug) setSlug(rev.slug);
      if (rev.featuredImage !== undefined) setFeaturedImage(rev.featuredImage || '');
      if (rev.categoryIds && Array.isArray(rev.categoryIds)) setCategoryIds(rev.categoryIds);
      if (rev.tagIds && Array.isArray(rev.tagIds)) setTagIds(rev.tagIds);
      if (rev.format) setFormat(rev.format);
      if (rev.seoTitle !== undefined) setSeoTitle(rev.seoTitle || '');
      if (rev.seoDescription !== undefined) setSeoDescription(rev.seoDescription || '');
      if (rev.canonicalUrl !== undefined) setCanonicalUrl(rev.canonicalUrl || '');
      if (rev.focusKeyword !== undefined) setFocusKeyword(rev.focusKeyword || '');

      // Content restore
      if (rev.content) {
        if (typeof rev.content === 'string' && (rev.contentFormat === 'html' || editorMode === 'raw' || rev.content.trim().startsWith('<'))) {
          setEditorMode('raw');
          setRawHtml(rev.content);
        } else {
          setEditorMode('tiptap');
          let parsed = rev.content;
          if (typeof rev.content === 'string') {
            try { parsed = JSON.parse(rev.content); } catch (e) {}
          }
          if (editor) {
            editor.chain().setContent(parsed, false).run();
          } else {
            setPendingJsonContent(parsed);
          }
        }
      }

      setShowRevisionsModal(false);
      setIsDirty(true);
      setSaveStatus('idle');
      window.AppModal.alert(`✅ Đã khôi phục thành công nội dung phiên bản ${formattedDate} vào trình soạn thảo!\n\nHãy kiểm tra lại và bấm "Update" hoặc "Save Draft" để lưu thay đổi.`);
    } catch (e: any) {
      window.AppModal.alert('Lỗi khi khôi phục dữ liệu phiên bản: ' + (e.message || String(e)));
    }
  };

  const restoreDraft = () => {
    if (!draftSnapshot) return;
    setTitle(draftSnapshot.title || '');
    setSlug(draftSnapshot.slug || '');
    setFeaturedImage(draftSnapshot.featuredImage || '');
    setCategoryIds(draftSnapshot.categoryIds || []);
    setTagIds(draftSnapshot.tagIds || []);
    setFormat(draftSnapshot.format || 'standard');
    setIsSticky(!!draftSnapshot.isSticky);
    setSeoTitle(draftSnapshot.seoTitle || '');
    setSeoDescription(draftSnapshot.seoDescription || '');
    setCanonicalUrl(draftSnapshot.canonicalUrl || '');
    setFocusKeyword(draftSnapshot.focusKeyword || '');
    setNoindex(!!draftSnapshot.noindex);
    setNofollow(!!draftSnapshot.nofollow);
    setCustomSchema(draftSnapshot.customSchema || '');
    if (draftSnapshot.authorId) setAuthorId(draftSnapshot.authorId);
    
    if (draftSnapshot.content) {
      if (typeof draftSnapshot.content === 'string' && (draftSnapshot.contentFormat === 'html' || editorMode === 'raw')) {
        setRawHtml(draftSnapshot.content);
      } else if (editor) {
        let parsedContent = draftSnapshot.content;
        try { 
          if (typeof draftSnapshot.content === 'string') {
            parsedContent = JSON.parse(draftSnapshot.content);
          }
        } catch (e) {}
        editor.commands.setContent(parsedContent);
      }
    }
    
    setDraftSnapshot(null);
    setIsDirty(true);
  };

  const discardDraft = async () => {
    const confirmed = await window.AppModal.confirm("Bạn có chắc chắn muốn hủy bỏ bản nháp? Toàn bộ thay đổi chưa xuất bản sẽ bị xóa vĩnh viễn.");
    if (confirmed) {
      try {
        await fetch(`/api/admin/posts/${postId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ isDraftDiscard: true })
        });
        window.location.reload();
      } catch (e) {
        window.AppModal.alert("Lỗi khi hủy nháp");
      }
    }
  };

  useEffect(() => {
    savePostRef.current = savePost;
  });

  const handleImageUpload = async (file: File) => {
    let fileToUpload = file;
    if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
      try {
        const compressedBlob = await imageCompression(file, {
          maxSizeMB: 10,
          maxWidthOrHeight: 2500,
          useWebWorker: false,
          initialQuality: 0.90,
          fileType: 'image/webp'
        });
        const newName = file.name.replace(/\.[^/.]+$/, ".webp");
        fileToUpload = new File([compressedBlob], newName, { type: 'image/webp' });
      } catch (err) {
        console.error('Compression error:', err);
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);

    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const resData = await res.json();
      if (resData.success && resData.data?.url) {
        return resData.data.url;
      }
    }
    throw new Error('Upload failed');
  };

  const openMediaPicker = (target: 'image' | 'featured', initialSearch?: string) => {
    setMediaModalTarget(target);
    setMediaInitialSearch(initialSearch || '');
    setIsMediaModalOpen(true);
  };

  const handleMediaSelected = (url: string, item?: any) => {
    if (mediaModalTarget === 'image') {
      if (editingImageNodePos !== null) {
        editor?.chain().focus()
          .setNodeSelection(editingImageNodePos)
          .updateAttributes('image', { src: url, alt: item?.alt || '', title: item?.title || '', caption: item?.caption || '' })
          .run();
        setEditingImageNodePos(null);
      } else {
        editor?.chain().focus().setImage({ src: url, alt: item?.alt || '', title: item?.title || '', caption: item?.caption || '' }).run();
      }
    } else if (mediaModalTarget === 'featured') {
      setFeaturedImage(url);
    }
    triggerAutosave();
  };

  const insertImage = () => {
    setEditingImageNodePos(null);
    openMediaPicker('image');
  };

  const handleFeaturedImageUpload = () => {
    let initialSearch = '';
    if (featuredImage) {
      const parts = featuredImage.split('/');
      initialSearch = parts[parts.length - 1];
    }
    openMediaPicker('featured', initialSearch);
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    setLinkInputUrl(activeLinkUrl || '');
    setIsEditingLink(true);
  }, [editor, activeLinkUrl]);

  const saveLink = useCallback(() => {
    if (!editor) return;
    if (linkInputUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let finalUrl = linkInputUrl;
      if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('mailto:') && !finalUrl.startsWith('tel:')) {
        finalUrl = 'https://' + finalUrl;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    }
    setIsEditingLink(false);
  }, [editor, linkInputUrl]);

  const handlePreview = async () => {
    if (!slug) {
      window.AppModal.alert('Vui lòng nhập tiêu đề để tạo slug trước khi xem trước!');
      return;
    }
    // Save draft snapshot first so preview sees the exact current editor state
    await savePost(status, true);
    // Lấy hostname hiện tại để tự động trỏ đúng domain (localhost hoặc server thật)
    const baseUrl = window.location.origin;
    const expires = Date.now() + 10 * 60 * 1000; // Link hết hạn sau 10 phút
    const expectedSecret = import.meta.env.PUBLIC_PREVIEW_SECRET || 'ladakh-preview-2026';
    window.open(`${baseUrl}/preview-post/${slug}?secret=${expectedSecret}&expires=${expires}`, '_blank');
  };

  const getSeoPreviewTitle = () => {
    let t = seoTitle || title || 'Untitled Post';
    t = t.replace(/%title%/gi, title || 'Untitled Post');
    return t.length > 60 ? t.substring(0, 60) + '...' : t;
  };
  const autoExcerpt = editor ? editor.getText().substring(0, 150).trim() : '';
  const getSeoPreviewDesc = () => {
    let desc = seoDescription || autoExcerpt || 'Đoạn văn này xuất hiện ở kết quả tìm kiếm Google và danh sách bài viết trên Web.';
    return desc.length > 160 ? desc.substring(0, 160) + '...' : desc;
  };

  const getWordCount = () => {
    let text = title || '';
    if (editorMode === 'tiptap' && editor) {
      text += ' ' + editor.getText();
    } else {
      text += ' ' + rawHtml.replace(/<[^>]*>?/gm, '');
    }
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };
  const wordCount = getWordCount();

  return (
    <>
      <div className="edit-topbar">
        <div className="breadcrumb">
          <a href="/admin">🏠</a>
          <span className="sep">/</span>
          <a href="/admin/posts">Posts</a>
          <span className="sep">/</span>
          <span className="current">{postId ? 'Edit Post' : 'New Post'}</span>
        </div>
        <div className="topbar-actions">
          <span className="save-indicator">
            {saveStatus === 'saving' ? '⏳ Saving...' : saveStatus === 'saved' ? `✓ Saved ${lastSaved?.toLocaleTimeString()}` : ''}
          </span>
          <button onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} style={{padding:'4px 8px', borderRadius:'6px', background:'#fff', border:'1px solid #d1d5db', cursor:'pointer'}}>↩</button>
          <button onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} style={{padding:'4px 8px', borderRadius:'6px', background:'#fff', border:'1px solid #d1d5db', cursor:'pointer'}}>↪</button>
          
          {draftSnapshot && (
             <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsDraftMenuOpen(!isDraftMenuOpen)} 
                  style={{ padding:'6px 12px', borderRadius:'6px', background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', cursor:'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📝 Bản nháp ▾
                </button>
                {isDraftMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '8px', zIndex: 50, width: '200px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', padding: '0 4px' }}>Có bản nháp tự động lưu</div>
                    <button onClick={() => { restoreDraft(); setIsDraftMenuOpen(false); }} style={{ width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '14px', display: 'block' }}>Tiếp tục viết</button>
                    <button onClick={() => { discardDraft(); setIsDraftMenuOpen(false); }} style={{ width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '14px', display: 'block', color: '#dc2626', marginTop: '4px' }}>Hủy bản nháp</button>
                  </div>
                )}
             </div>
          )}

          {postId && (
            <button 
              type="button"
              className="btn-revisions" 
              onClick={() => { setShowRevisionsModal(true); loadRevisions(); }} 
              style={{
                padding: '6px 12px', 
                borderRadius: '6px', 
                background: '#f8fafc', 
                color: '#334155', 
                border: '1px solid #cbd5e1', 
                cursor: 'pointer', 
                fontWeight: '500', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px'
              }}
              title="Xem lại các phiên bản đã cập nhật và khôi phục nội dung cũ"
            >
              🕒 Lịch sử bản cũ
            </button>
          )}

          {status === 'published' && slug && (
            <a 
              href={`/${slug}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{padding: '6px 12px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981', cursor: 'pointer', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px'}}
            >
              🌍 Xem web
            </a>
          )}
          <button className="btn-preview" onClick={handlePreview} style={{padding: '6px 12px', borderRadius: '6px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: '500'}}>Preview</button>
          <button 
            className="btn-draft" 
            disabled={saveStatus === 'saving'}
            onClick={() => savePost(undefined, status === 'published')}
            style={{
              opacity: saveStatus === 'saving' ? 0.65 : 1,
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
            }}
          >
            {saveStatus === 'saving' ? 'Đang lưu...' : 'Save Draft'}
          </button>
          <button 
            className="btn-publish-top" 
            disabled={saveStatus === 'saving'}
            onClick={() => savePost('published', false)}
            style={{
              opacity: saveStatus === 'saving' ? 0.65 : 1,
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
            }}
          >
            {saveStatus === 'saving' ? '⏳ Đang lưu...' : (status === 'published' ? 'Update' : 'Publish ▾')}
          </button>
        </div>
      </div>

      <div className="edit-grid">
        <div className="editor-card">
          <textarea 
            ref={titleTextareaRef}
            className="editor-title" 
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled post..." 
            rows={1}
            style={{ resize: 'none', overflow: 'hidden', minHeight: '60px' }}
          />
          
          {format !== 'astro-code' && (
          <div style={{display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '16px', width: 'fit-content'}}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => {
                  if (isElementor) return;
                  if (editorMode === 'raw' && rawHtml.trim() !== '') {
                    setShowTiptapConfirm(true);
                  } else {
                    setEditorMode('tiptap');
                    setFormat('standard');
                  }
                }}
                disabled={isElementor}
                title={isElementor ? "Tắt 'Giao diện tùy chỉnh' để dùng Tiptap" : ""}
                style={{
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  cursor: isElementor ? 'not-allowed' : 'pointer', 
                  border: 'none', 
                  background: editorMode === 'tiptap' ? '#fff' : 'transparent', 
                  color: editorMode === 'tiptap' ? '#2563eb' : '#64748b', 
                  boxShadow: editorMode === 'tiptap' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', 
                  transition: 'all 0.2s',
                  opacity: isElementor ? 0.5 : 1
                }}
              >
                ✍️ Tiptap Editor
              </button>
              
              {showTiptapConfirm && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', zIndex: 50 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Mã HTML phức tạp sẽ bị xóa. Tiếp tục?</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                      setEditorMode('tiptap');
                      setFormat('standard');
                      editor?.commands.setContent(rawHtml);
                      setShowTiptapConfirm(false);
                    }} style={{ padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Chuyển</button>
                    <button onClick={() => setShowTiptapConfirm(false)} style={{ padding: '4px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Hủy</button>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => {
                if (editorMode === 'tiptap' && editor && !editor.isEmpty) {
                  setRawHtml(editor.getHTML());
                }
                setEditorMode('raw');
                setFormat('landing');
              }}
              style={{padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: editorMode === 'raw' ? '#fff' : 'transparent', color: editorMode === 'raw' ? '#ef4444' : '#64748b', boxShadow: editorMode === 'raw' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s'}}
            >
              💻 Raw HTML Code
            </button>
          </div>
          )}

          <div className={`prose-editor-container ${(editorMode === 'raw' || format === 'astro-code') ? 'hidden' : ''}`} style={{ display: (editorMode === 'raw' || format === 'astro-code') ? 'none' : 'block' }}>

          <div className="block-hint">✏️ Type / to choose a block</div>

          <div className="editor-content relative" onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName.toLowerCase() === 'a' || target.closest('a')) {
              e.preventDefault();
            }
          }}>
            {editor && (
              <FloatingMenu editor={editor} tippyOptions={{ duration: 100, placement: 'left' }}>
                <div className="inserter-wrap" style={{marginTop: 0, marginLeft: '-16px'}}>
                  <button className="inserter-btn">+</button>
                  <div className="inserter-dropdown">

                    <button className="ins-item" onClick={() => editor.chain().focus().setParagraph().run()}><span className="ins-icon">¶</span> Paragraph</button>
                    <button className="ins-item" onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}><span className="ins-icon">H2</span> Heading 2</button>
                    <button className="ins-item" onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}><span className="ins-icon">H3</span> Heading 3</button>
                    <button className="ins-item" onClick={() => editor.chain().focus().toggleBulletList().run()}><span className="ins-icon">≡</span> List</button>
                    <button className="ins-item" onClick={insertImage}><span className="ins-icon">🖼</span> Image</button>
                    <button className="ins-item" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><span className="ins-icon">▦</span> Table</button>
                    <button className="ins-item" onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const url = await window.AppModal.prompt('Nhập đường dẫn YouTube (Ví dụ: https://www.youtube.com/watch?v=...)');
                      if (url && url.trim() !== '') editor.chain().focus().setYoutubeVideo({ src: url }).run();
                    }}><span className="ins-icon">▶</span> YouTube</button>
                    <button className="ins-item" onClick={() => {
                      editor.chain().focus().insertContent({
                        type: 'mediaCard',
                        attrs: { src: '', alt: '' },
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Xem thêm: ' }] }],
                      }).run();
                    }}><span className="ins-icon">🃏</span> Media Card <span className="ins-new">NEW</span></button>
                    <button className="ins-item" onClick={() => window.AppModal.alert('Tính năng Tour Card đang được phát triển')}><span className="ins-icon">🌍</span> Tour Card <span className="ins-new">NEW</span></button>
                    <button className="ins-item" onClick={() => {
                      editor.chain().focus().insertContent({
                        type: 'faqBlock',
                        attrs: { questions: [{ q: 'Câu hỏi mới?', a: '' }] },
                      }).run();
                    }}><span className="ins-icon">❓</span> FAQ Block <span className="ins-new">NEW</span></button>
                  </div>
                </div>
              </FloatingMenu>
            )}

            {/* Text formatting BubbleMenu */}
            {editor && (
              <BubbleMenu 
                editor={editor} 
                tippyOptions={{ duration: 100 }} 
                shouldShow={({ editor, state, from, to }) => {
                  if (editor.isActive('table') || editor.isActive('image') || editor.isActive('link')) return false;
                  // Only show when text is explicitly selected to prevent jumping during typing
                  return from !== to;
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: '4px', background: '#1f2937', padding: '6px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                  <select 
                    value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p'}
                    onChange={(e) => {
                      if (e.target.value === 'p') editor.chain().focus().setParagraph().run();
                      if (e.target.value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                      if (e.target.value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                      if (e.target.value === 'h4') editor.chain().focus().toggleHeading({ level: 4 }).run();
                    }}
                    style={{ background: '#374151', color: '#fff', border: 'none', outline: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <option value="p">Đoạn văn (P)</option>
                    <option value="h2">Tiêu đề 2 (H2)</option>
                    <option value="h3">Tiêu đề 3 (H3)</option>
                    <option value="h4">Tiêu đề 4 (H4)</option>
                  </select>
                  <span style={{width: '1px', height: '16px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={() => editor.chain().focus().toggleBold().run()} style={{color: editor.isActive('bold') ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 'bold'}}>B</button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()} style={{color: editor.isActive('italic') ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontStyle: 'italic'}}>I</button>
                  <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={{color: editor.isActive('underline') ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', textDecoration: 'underline'}}>U</button>
                  <button onClick={() => editor.chain().focus().toggleStrike().run()} style={{color: editor.isActive('strike') ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', textDecoration: 'line-through'}}>S</button>
                  <span style={{width: '1px', height: '16px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={() => editor.chain().focus().setTextAlign('left').run()} style={{color: editor.isActive({ textAlign: 'left' }) ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px'}}>L</button>
                  <button onClick={() => editor.chain().focus().setTextAlign('center').run()} style={{color: editor.isActive({ textAlign: 'center' }) ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px'}}>C</button>
                  <button onClick={() => editor.chain().focus().setTextAlign('right').run()} style={{color: editor.isActive({ textAlign: 'right' }) ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px'}}>R</button>
                  <span style={{width: '1px', height: '16px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={setLink} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px'}}>🔗</button>
                </div>
              </BubbleMenu>
            )}

            {/* Link Edit BubbleMenu - WordPress Style */}
            {editor && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'bottom', onHidden: () => setIsEditingLink(false) }} shouldShow={({ editor }) => editor.isActive('link') || isEditingLink}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
                  {!isEditingLink ? (
                    <>
                      <div style={{width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#475569'}}>
                        🌐
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', minWidth: '150px', maxWidth: '250px'}}>
                        <a 
                          href={activeLinkUrl || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!activeLinkUrl) e.preventDefault();
                          }} 
                          style={{color: '#2563eb', fontSize: '13px', fontWeight: 500, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                        >
                          {activeLinkUrl || 'Đường dẫn rỗng'}
                        </a>
                      </div>
                      <div style={{width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px'}}></div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <button onClick={(e) => { e.preventDefault(); setLink(); }} title="Chỉnh sửa" style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#475569', fontSize: '15px'}}>
                          ✎
                        </button>
                        <button onClick={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run(); }} title="Gỡ liên kết" style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#475569', fontSize: '15px'}}>
                          🔗<span style={{textDecoration: 'line-through', position: 'absolute', opacity: 0.7, transform: 'rotate(-45deg)'}}>-</span>
                        </button>
                        <button onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(activeLinkUrl || ''); window.AppModal.alert('Đã copy đường dẫn!'); }} title="Sao chép" style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#475569', fontSize: '15px'}}>
                          📋
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        value={linkInputUrl}
                        onChange={(e) => setLinkInputUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLink(); } if (e.key === 'Escape') { e.preventDefault(); setIsEditingLink(false); } }}
                        placeholder="Nhập đường dẫn URL..."
                        style={{border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 10px', fontSize: '13px', width: '220px', outline: 'none'}}
                        autoFocus
                      />
                      <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px'}}>
                        <button onClick={(e) => { e.preventDefault(); saveLink(); }} title="Lưu lại" style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2563eb', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#fff', fontSize: '15px'}}>
                          ↵
                        </button>
                        <button onClick={(e) => { e.preventDefault(); setIsEditingLink(false); }} title="Hủy bỏ" style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#475569', fontSize: '15px'}}>
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </BubbleMenu>
            )}

            {/* Image alignment BubbleMenu */}
            {editor && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} shouldShow={({ editor }) => editor.isActive('image')}>
                <div style={{display: 'flex', gap: '2px', background: '#1f2937', padding: '6px', borderRadius: '8px', fontSize: '12px'}}>
                  <button onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()} style={{color: editor.getAttributes('image').align === 'left' ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>◧ Left</button>
                  <button onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()} style={{color: editor.getAttributes('image').align === 'center' ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>◻ Center</button>
                  <button onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()} style={{color: editor.getAttributes('image').align === 'right' ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>◨ Right</button>
                  <button onClick={() => editor.chain().focus().updateAttributes('image', { align: 'full' }).run()} style={{color: (!editor.getAttributes('image').align || editor.getAttributes('image').align === 'full') ? '#60a5fa' : '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>▣ Full</button>
                  <span style={{width: '1px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={(e) => {
                    e.preventDefault();
                    setEditingImageNodePos(editor.state.selection.from);
                    let initialSearch = '';
                    const src = editor.getAttributes('image').src;
                    if (src) {
                      const parts = src.split('/');
                      initialSearch = parts[parts.length - 1];
                    }
                    openMediaPicker('image', initialSearch);
                  }} style={{color: '#fbbf24', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>✎ Sửa/Thay ảnh</button>
                  <span style={{width: '1px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={() => editor.chain().focus().deleteSelection().run()} style={{color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600}}>🗑 Del</button>
                </div>
              </BubbleMenu>
            )}

            {editor && editor.isActive('table') && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} shouldShow={({ editor }) => editor.isActive('table')}>
                <div style={{display: 'flex', gap: '4px', background: '#1f2937', padding: '6px', borderRadius: '8px', fontSize: '12px'}}>
                  <button onClick={() => editor.chain().focus().addColumnBefore().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>+ColL</button>
                  <button onClick={() => editor.chain().focus().addColumnAfter().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>+ColR</button>
                  <button onClick={() => editor.chain().focus().deleteColumn().run()} style={{color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>-Col</button>
                  <span style={{width: '1px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={() => editor.chain().focus().addRowBefore().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>+RowU</button>
                  <button onClick={() => editor.chain().focus().addRowAfter().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>+RowD</button>
                  <button onClick={() => editor.chain().focus().deleteRow().run()} style={{color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>-Row</button>
                  <span style={{width: '1px', background: '#4b5563', margin: '0 4px'}}></span>
                  <button onClick={() => editor.chain().focus().mergeCells().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>Merge</button>
                  <button onClick={() => editor.chain().focus().splitCell().run()} style={{color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px'}}>Split</button>
                  <button onClick={() => editor.chain().focus().deleteTable().run()} style={{color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', fontWeight: 'bold'}}>Del Table</button>
                </div>
              </BubbleMenu>
            )}

            <EditorContent editor={editor} />
          </div>
          </div>

          {format === 'astro-code' && (
            <div style={{ padding: '40px 20px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '12px', textAlign: 'center', margin: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
              <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '20px' }}>Bài viết Code Native (Astro)</h3>
              <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: 1.6 }}>
                Bài viết này được cấu hình làm <b>Data Placeholder</b> cho một file <code>.astro</code> vật lý riêng biệt.<br/>
                Vui lòng <b>không nhập nội dung</b> ở đây. Hãy code thiết kế của bạn trực tiếp trong file:<br/>
                <code style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', color: '#2563eb', fontWeight: 'bold', display: 'inline-block', marginTop: '8px' }}>src/pages/{slug || '[slug]'}.astro</code>
              </p>
            </div>
          )}

          {editorMode === 'raw' && format !== 'astro-code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#1e293b', fontSize: '14px' }}>Công cụ trích xuất ảnh</h4>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '12px' }}>Nếu bạn muốn đập bỏ Elementor để xây lại bằng Tiptap, hãy dùng công cụ này để lấy lại toàn bộ link ảnh bị giấu trong mã HTML.</p>
                </div>
                <button 
                  onClick={() => {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = rawHtml;
                    const imgs: {url: string, alt: string}[] = [];
                    // Extract standard images
                    tempDiv.querySelectorAll('img').forEach(img => {
                      if (img.src) imgs.push({url: img.src, alt: img.alt || ''});
                    });
                    // Extract Elementor gallery images
                    tempDiv.querySelectorAll('.e-gallery-image').forEach(div => {
                      const src = div.getAttribute('data-thumbnail');
                      if (src) imgs.push({url: src, alt: div.getAttribute('aria-label') || ''});
                    });
                    // Deduplicate
                    const unique = imgs.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);
                    setExtractedImages(unique);
                    if (unique.length > 0) {
                       window.AppModal.alert(`Đã tìm thấy ${unique.length} ảnh! Cuộn xuống dưới khung HTML để xem.`);
                    } else {
                       window.AppModal.alert("Không tìm thấy ảnh nào trong mã HTML.");
                    }
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}
                >
                  🔍 Tìm & Trích xuất ảnh
                </button>
              </div>

              <div style={{ height: '500px' }}>
                <textarea
                  value={rawHtml}
                  onChange={(e) => {
                    setRawHtml(e.target.value);
                    triggerAutosave();
                  }}
                  placeholder="Nhập mã HTML thuần + TailwindCSS ở đây..."
                  style={{ width: '100%', height: '100%', padding: '16px', fontSize: '14px', fontFamily: 'monospace', lineHeight: 1.5, border: '1px solid #e2e8f0', borderRadius: '8px', background: '#0f172a', color: '#f8fafc', outline: 'none', resize: 'vertical' }}
                  spellCheck={false}
                />
              </div>

              {extractedImages.length > 0 && (
                <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>Kho ảnh đã trích xuất ({extractedImages.length})</h4>
                    <button 
                      onClick={() => {
                        let htmlOutput = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">\n';
                        extractedImages.forEach(img => {
                          htmlOutput += `  <img src="${img.url}" alt="${img.alt}" class="w-full h-auto rounded-lg shadow-md object-cover aspect-square" />\n`;
                        });
                        htmlOutput += '</div>';
                        navigator.clipboard.writeText(htmlOutput);
                        window.AppModal.alert("Đã Copy toàn bộ mã HTML Gallery sử dụng TailwindCSS!");
                      }}
                      style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      📋 Copy toàn bộ HTML Gallery (Tailwind)
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {extractedImages.map((img, i) => (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                        <img src={img.url} alt={img.alt} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                        <div style={{ padding: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(img.url);
                              window.AppModal.alert('Đã copy Link ảnh!');
                            }} 
                            style={{ padding: '4px', fontSize: '11px', cursor: 'pointer', background: '#e2e8f0', border: 'none', borderRadius: '4px' }}
                          >
                            🔗 Copy Link URL
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`<img src="${img.url}" alt="${img.alt}" class="w-full rounded-lg" />`);
                              window.AppModal.alert('Đã copy thẻ HTML <img>!');
                            }} 
                            style={{ padding: '4px', fontSize: '11px', cursor: 'pointer', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px' }}
                          >
                            💻 Copy Thẻ HTML
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="psection" style={{padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}>
            <button onClick={() => setIsSeoModalOpen(true)} style={{width: '100%', padding: '12px', background: '#fff', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', transition: 'all 0.2s'}} onMouseOver={e => {e.currentTarget.style.background = '#eff6ff';}} onMouseOut={e => {e.currentTarget.style.background = '#fff';}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', lineHeight: 1 }}>
                <span>Tùy chỉnh SEO nâng cao</span>
                <span style={{ fontSize: '11px', fontWeight: 500, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{wordCount} từ</span>
              </div>
            </button>
          </div>

          <div className="ptab-content">
            <div className="psection">
              <div className="psection-head"><h4>Featured Image</h4></div>
              {featuredImage ? (
                <div style={{position: 'relative', cursor: 'pointer'}} onClick={handleFeaturedImageUpload} title="Nhấn để thay thế ảnh">
                  <img src={featuredImage} alt="Featured" className="fimg" style={{width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                  <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '12px', textAlign: 'center', padding: '4px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px'}}>Nhấn để thay ảnh</div>
                  <button onClick={(e) => { e.stopPropagation(); setFeaturedImage(''); triggerAutosave(); }} style={{position: 'absolute', top: '8px', right: '8px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'}}>×</button>
                </div>
              ) : (
                <button onClick={handleFeaturedImageUpload} style={{width: '100%', padding: '24px', border: '2px dashed #d1d5db', borderRadius: '8px', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px'}}>
                  + Upload Image
                </button>
              )}
            </div>

            <hr className="pdivider" />

            <div className="psection">
              <div className="psection-head"><h4>Status</h4></div>
              <select className="pselect" value={status} onChange={e => { setStatus(e.target.value); triggerAutosave(); }}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
              </select>
              
              <div style={{marginTop: '12px'}}>
                <div style={{fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Giao diện hiển thị</div>
                <select className="pselect" value={format} onChange={e => { setFormat(e.target.value); triggerAutosave(); }}>
                  <option value="standard">Blog Tiêu Chuẩn (Có Sidebar)</option>
                  <option value="landing">Landing Page (Tràn Viền 100%)</option>
                  <option value="astro-code">Code Astro (Tắt Editor)</option>
                </select>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>
                  * Chọn <b>Landing Page</b> nếu bạn dùng code HTML ở tab Raw để thiết kế tràn viền giống Elementor.
                </div>
              </div>
              
              <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'}}>
                <input type="checkbox" id="isSticky" checked={isSticky} onChange={e => { setIsSticky(e.target.checked); triggerAutosave(); }} />
                <label htmlFor="isSticky">Stick to the top of the blog</label>
              </div>

              {isElementor && (
              <div style={{marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
                <input type="checkbox" id="isElementor" checked={isElementor} onChange={e => { 
                  setIsElementor(e.target.checked); 
                  if (!e.target.checked) setFormat('landing');
                  triggerAutosave(); 
                }} style={{ marginTop: '2px' }} />
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label htmlFor="isElementor" style={{ color: '#475569', fontWeight: 600 }}>Giữ mã nguồn Elementor cũ</label>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Bỏ tick nếu bạn đã dọn dẹp sạch sẽ mã HTML thừa của Elementor.</span>
                </div>
              </div>
              )}
            </div>

            <hr className="pdivider" />

            {categoryIds.some(id => categories.find(c => String(c.id) === String(id))?.slug === 'hanh-trinh-doanh-nghiep') && (
              <>
                <div className="psection" style={{ background: '#fdf4ff', padding: '16px', borderRadius: '8px', border: '1px solid #fbcfe8' }}>
                  <div className="psection-head"><h4 style={{ color: '#be185d' }}>Hành Trình Doanh Nghiệp</h4></div>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9d174d', marginBottom: '4px' }}>Vị trí (Location)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: locations.length > 0 ? '8px' : '0' }}>
                      {locations.map((loc, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid #fbcfe8', borderRadius: '16px', background: '#fdf2f8' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#9d174d' }}>{loc}</span>
                          <button onClick={() => { setLocations(locations.filter((_, i) => i !== idx)); triggerAutosave(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', lineHeight: '1' }} title="Xóa">&times;</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input 
                          type="text" 
                          className="pselect" 
                          value={locationSearchTerm} 
                          onChange={e => { setLocationSearchTerm(e.target.value); setIsLocationDropdownOpen(true); }} 
                          onFocus={() => setIsLocationDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsLocationDropdownOpen(false), 200)}
                          placeholder="Tìm hoặc tạo địa điểm mới..."
                          style={{ borderColor: '#fbcfe8' }}
                        />
                        {isLocationDropdownOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #fbcfe8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            {COMMON_LOCATIONS
                              .filter(l => l.toLowerCase().includes(locationSearchTerm.toLowerCase()))
                              .map(l => (
                                <div 
                                  key={l} 
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #fbcfe8' }}
                                  onMouseDown={(e) => { e.preventDefault(); if(!locations.includes(l)) setLocations([...locations, l]); setIsLocationDropdownOpen(false); setLocationSearchTerm(''); triggerAutosave(); }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#fdf2f8')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {l}
                                </div>
                            ))}
                            
                            {locationSearchTerm.trim() !== '' && !COMMON_LOCATIONS.some(l => l.toLowerCase() === locationSearchTerm.trim().toLowerCase()) && (
                              <div 
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: '#be185d', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid #fbcfe8', background: '#fdf2f8' }}
                                onMouseDown={async (e) => { 
                                  e.preventDefault(); 
                                  const confirm = await window.AppModal.confirm(`Bạn có chắc muốn dùng địa điểm mới: "${locationSearchTerm.trim()}"?`);
                                  if (confirm) {
                                    if(!locations.includes(locationSearchTerm.trim())) setLocations([...locations, locationSearchTerm.trim()]);
                                    setIsLocationDropdownOpen(false);
                                    setLocationSearchTerm('');
                                    triggerAutosave();
                                  }
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#fce7f3')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fdf2f8')}
                              >
                                <span style={{ fontSize: '16px' }}>+</span> Dùng địa điểm mới: "{locationSearchTerm}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    <span style={{ fontSize: '11px', color: '#db2777', display: 'block', marginTop: '4px' }}>Thông tin này sẽ được hiển thị trên giao diện Showcase.</span>
                  </div>
                </div>
                <hr className="pdivider" />
              </>
            )}

            <div className="psection">
              <div className="psection-head"><h4>Tác giả</h4></div>
              <select
                value={authorId}
                onChange={(e) => { setAuthorId(e.target.value); triggerAutosave(); }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">— Mặc định (Admin) —</option>
                {authorList.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <hr className="pdivider" />

            <div className="psection">
              <div className="psection-head"><h4>Categories</h4></div>
              <div className="category-list" style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px'}}>
                {(categories || []).map(c => (
                  <div key={c.id} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px'}}>
                    <input 
                      type="checkbox" 
                      id={`cat-${c.id}`} 
                      checked={(categoryIds || []).includes(String(c.id))} 
                      onChange={() => handleCategoryToggle(String(c.id))} 
                    />
                    <label htmlFor={`cat-${c.id}`} style={{cursor: 'pointer'}}>
                      {Array(c.depth || 0).fill('—').join('')} {c.name}
                    </label>
                  </div>
                ))}
                {(categories || []).length === 0 && <span style={{color: '#94a3b8', fontSize: '12px'}}>No categories yet.</span>}
              </div>
              <a href="/admin/categories" target="_blank" style={{display: 'block', marginTop: '8px', fontSize: '12px', color: '#2563eb'}}>+ Add New Category</a>
            </div>

            <hr className="pdivider" />

            <div className="psection">
              <div className="psection-head"><h4>Tags</h4></div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px'}}>
                {tags.filter(t => tagIds.includes(t.id)).map(tag => (
                  <span key={tag.id} style={{background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    {tag.name}
                    <button onClick={() => handleTagToggle(tag.id)} style={{border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', lineHeight: '1'}}>&times;</button>
                  </span>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="pselect"
                  placeholder="Type to search or add tag..."
                  value={tagSearchTerm}
                  onChange={e => {
                    setTagSearchTerm(e.target.value);
                    setIsTagDropdownOpen(true);
                  }}
                  onFocus={() => setIsTagDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsTagDropdownOpen(false), 200)}
                />
                {isTagDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    {tags
                      .filter(t => !tagIds.includes(t.id) && t.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                      .map(t => (
                        <div 
                          key={t.id} 
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                          onMouseDown={(e) => { e.preventDefault(); handleTagToggle(t.id); setTagSearchTerm(''); setIsTagDropdownOpen(false); }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {t.name}
                        </div>
                    ))}
                    
                    {tagSearchTerm.trim() !== '' && !tags.some(t => t.name.toLowerCase() === tagSearchTerm.trim().toLowerCase()) && (
                      <div 
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: '#2563eb', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid #e2e8f0', background: '#eff6ff' }}
                        onMouseDown={(e) => { e.preventDefault(); handleCreateTag(); }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#eff6ff')}
                      >
                        <span style={{ fontSize: '16px' }}>+</span> Add new tag: "{tagSearchTerm}"
                      </div>
                    )}
                    
                    {tags.filter(t => !tagIds.includes(t.id) && t.name.toLowerCase().includes(tagSearchTerm.toLowerCase())).length === 0 && tagSearchTerm === '' && (
                      <div style={{ padding: '8px 12px', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                        Start typing to search tags...
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{marginTop: '8px', fontSize: '12px', color: '#64748b'}}>
                <span>{tagIds.length} / 8 tags used</span>
              </div>
              {tagIds.length > 8 && <span style={{fontSize: '11px', color: '#ef4444'}}>Warning: Too many tags can harm SEO.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SEO Configuration Modal */}
      {isSeoModalOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
          <div style={{background: '#fff', padding: '24px', borderRadius: '12px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b'}}>Tùy chỉnh SEO nâng cao</h2>
                <span style={{background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600}}>
                  {wordCount} từ
                </span>
              </div>
              <button onClick={() => setIsSeoModalOpen(false)} style={{background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', lineHeight: 1, color: '#64748b'}}>&times;</button>
            </div>
            
            {/* Search Snippet Preview */}
            <div style={{marginBottom: '20px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc'}}>
              <span style={{fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block', fontWeight: 600}}>Google Preview</span>
              <div style={{fontSize: '18px', color: '#1a0dab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px'}}>{getSeoPreviewTitle()}</div>
              <div style={{fontSize: '14px', color: '#006621', marginBottom: '4px'}}>{typeof window !== 'undefined' ? window.location.origin : 'https://dulichladakh.com'}/{slug}</div>
              <div style={{fontSize: '14px', color: '#545454', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{getSeoPreviewDesc()}</div>
            </div>

            <div style={{marginBottom: '16px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                <label style={{fontSize: '14px', fontWeight: 600, color: '#1e293b'}}>Tiêu đề SEO</label>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: '#64748b'}}>{(seoTitle || title || '').length} / 60</span>
                  <SeoProgressBar length={(seoTitle || title || '').length} min={30} max={60} maxDisplay={75} />
                </div>
              </div>
              <input type="text" value={seoTitle} onChange={e => { setSeoTitle(e.target.value); triggerAutosave(); }} className="pselect" placeholder="Để trống sẽ tự động lấy Tiêu đề bài viết" style={{borderColor: '#cbd5e1', padding: '10px'}} />
              <span style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '6px'}}>Nên sử dụng từ khóa chính. Nếu để trống, hệ thống sẽ tự động lấy Tiêu đề bài viết.</span>
            </div>
            
            <div style={{marginBottom: '16px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                <label style={{fontSize: '14px', fontWeight: 600, color: '#1e293b'}}>Liên kết cố định (URL Slug)</label>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: '#64748b'}}>{slug.length} / 75</span>
                  <SeoProgressBar length={slug.length} min={10} max={75} maxDisplay={90} />
                </div>
              </div>
              <input type="text" value={slug} onChange={e => { setSlug(e.target.value); setIsSlugManual(true); triggerAutosave(); }} className="pselect" style={{borderColor: isPublishedOriginally ? '#f87171' : '#cbd5e1', color: '#2563eb', padding: '10px'}} />
              <span style={{fontSize: '12px', color: isPublishedOriginally ? '#ef4444' : '#94a3b8', display: 'block', marginTop: '6px', fontWeight: isPublishedOriginally ? 600 : 400}}>Cảnh báo: Thay đổi URL của bài viết đã xuất bản có thể làm rớt hạng SEO. Vui lòng cân nhắc kỹ.</span>
            </div>

            <div style={{marginBottom: '16px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                <label style={{fontSize: '14px', fontWeight: 600, color: '#1e293b'}}>Mô tả ngắn & SEO</label>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: '#64748b'}}>{seoDescription ? seoDescription.length : autoExcerpt.length} / 160</span>
                  <SeoProgressBar length={seoDescription ? seoDescription.length : autoExcerpt.length} min={120} max={160} maxDisplay={180} />
                </div>
              </div>
              <textarea value={seoDescription} onChange={e => { setSeoDescription(e.target.value); triggerAutosave(); }} className="pselect" placeholder={autoExcerpt || "Đoạn tóm tắt bài viết..."} rows={4} style={{resize: 'vertical', width: '100%', borderColor: '#cbd5e1', padding: '10px'}}></textarea>
              <span style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '6px'}}>Đoạn văn này xuất hiện ở kết quả tìm kiếm Google và danh sách bài viết trên Web.</span>
            </div>

            <div style={{marginBottom: '16px'}}>
              <label style={{fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '8px'}}>Từ khóa chính (Focus Keyword)</label>
              <input type="text" value={focusKeyword} onChange={e => { setFocusKeyword(e.target.value); triggerAutosave(); }} className="pselect" placeholder="VD: du lịch tân cương" style={{borderColor: '#cbd5e1', padding: '10px'}} />
              <span style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '6px'}}>Giúp hệ thống quản lý chủ đề, tránh viết trùng lặp (Cannibalization).</span>
            </div>

            <div style={{marginBottom: '16px', display: 'flex', gap: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1e293b', cursor: 'pointer', fontWeight: 500}}>
                <input type="checkbox" checked={noindex} onChange={e => { setNoindex(e.target.checked); triggerAutosave(); }} style={{width: '16px', height: '16px'}} />
                <span>No Index (Ẩn khỏi Google)</span>
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1e293b', cursor: 'pointer', fontWeight: 500}}>
                <input type="checkbox" checked={nofollow} onChange={e => { setNofollow(e.target.checked); triggerAutosave(); }} style={{width: '16px', height: '16px'}} />
                <span>No Follow (Không chia sẻ Link Juice)</span>
              </label>
            </div>

            <div style={{marginBottom: '16px'}}>
              <label style={{fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '8px'}}>Schema (Article) - Nâng cao</label>
              <textarea value={customSchema} onChange={e => { setCustomSchema(e.target.value); triggerAutosave(); }} className="pselect" placeholder='{"@context": "https://schema.org", "@type": "Article", ...}&#10;(Để trống để tự động tạo)' rows={6} style={{resize: 'vertical', width: '100%', borderColor: '#cbd5e1', padding: '10px', fontFamily: 'monospace', fontSize: '12px', backgroundColor: customSchema ? '#fff' : '#f8fafc'}}></textarea>
              <span style={{fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '6px'}}>Mặc định hệ thống tự động tạo mã Schema chuẩn. Chỉ nhập JSON-LD vào đây nếu bạn muốn Ghi đè (Override). Lưu ý: Phải đúng cú pháp JSON hợp lệ.</span>
            </div>

            <div style={{marginTop: '24px', display: 'flex', justifyContent: 'flex-end'}}>
              <button onClick={() => setIsSeoModalOpen(false)} style={{background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}>Đóng & Lưu</button>
            </div>
          </div>
        </div>
      )}
      {/* Revisions / Changelog Modal */}
      {showRevisionsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: 'min(1150px, 96vw)',
            height: '86vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🕒</span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    Lịch sử chỉnh sửa & Phiên bản (Changelog)
                  </h2>
                  <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {revisionsList.length} bản lưu
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Xem lại toàn bộ các mốc lưu trữ trước đây và khôi phục nội dung cũ khi cần thiết.
                </p>
              </div>
              <button 
                onClick={() => setShowRevisionsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
                title="Đóng"
              >
                &times;
              </button>
            </div>

            {/* Modal Body - 2 Columns */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', overflow: 'hidden' }}>
              {/* Left Column: Revision List */}
              <div style={{
                borderRight: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Các mốc thời gian
                  </span>
                  <button 
                    onClick={loadRevisions}
                    disabled={isLoadingRevisions}
                    style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {isLoadingRevisions ? 'Đang tải...' : '🔄 Làm mới'}
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                  {isLoadingRevisions ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: '13px' }}>
                      ⏳ Đang tải danh sách phiên bản...
                    </div>
                  ) : revisionsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                      Chưa có phiên bản cũ nào được ghi nhận.<br />
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Mỗi khi bạn bấm Lưu/Cập nhật, hệ thống sẽ tự động tạo một mốc lịch sử ở đây.</span>
                    </div>
                  ) : (
                    revisionsList.map((rev, idx) => {
                      const isSelected = selectedRevision?.id === rev.id;
                      const dateObj = new Date(rev.createdAt);
                      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const kbSize = rev.contentLength ? (Math.round(rev.contentLength / 102.4) / 10) : 0;

                      return (
                        <div
                          key={rev.id || idx}
                          onClick={() => handleSelectRevision(rev.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            background: isSelected ? '#eff6ff' : '#fff',
                            border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 2px 4px rgba(59, 130, 246, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                              {timeStr}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {dateStr}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {rev.title || 'Bài viết chưa đặt tên'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', background: isSelected ? '#dbeafe' : '#f1f5f9', color: isSelected ? '#1e40af' : '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                              👤 {rev.author || 'Admin'}
                            </span>
                            <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>
                              {rev.changeNote || 'Cập nhật'}
                            </span>
                            {kbSize > 0 && (
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
                                {kbSize} KB
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Revision Detail & Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
                {isLoadingRevDetail ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    ⏳ Đang tải nội dung chi tiết phiên bản...
                  </div>
                ) : !selectedRevision ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: '40px' }}>
                    <span style={{ fontSize: '40px', marginBottom: '12px' }}>📄</span>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#64748b' }}>Chọn một mốc thời gian ở cột bên trái</p>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>Nội dung chi tiết của phiên bản đó sẽ hiển thị ở đây để bạn xem trước và khôi phục.</p>
                  </div>
                ) : (
                  <>
                    {/* Detail Header Bar */}
                    <div style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            Phiên bản lúc: {new Date(selectedRevision.createdAt).toLocaleString('vi-VN')}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Tác giả: <strong>{selectedRevision.author || 'Admin'}</strong>
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedRevision.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreRevision(selectedRevision)}
                        style={{
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ↩ Khôi phục bản này vào Editor
                      </button>
                    </div>

                    {/* Detail Content Preview */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
                      {/* Meta Information Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Đường dẫn (Slug)</span>
                          <code style={{ fontSize: '13px', color: '#2563eb' }}>/{selectedRevision.slug}</code>
                        </div>
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Định dạng nội dung</span>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>{selectedRevision.contentFormat === 'html' ? 'Raw HTML' : 'Tiptap JSON'}</span>
                        </div>
                        {selectedRevision.focusKeyword && (
                          <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Từ khóa chính</span>
                            <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>{selectedRevision.focusKeyword}</span>
                          </div>
                        )}
                      </div>

                      {/* Excerpt if present */}
                      {selectedRevision.excerpt && (
                        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Đoạn tóm tắt (Excerpt)</span>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{selectedRevision.excerpt}</p>
                        </div>
                      )}

                      {/* Content Preview Box */}
                      <div>
                        <span style={{ fontSize: '12px', color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          Nội dung bài viết phiên bản này
                        </span>
                        {(() => {
                          const content = selectedRevision.content;
                          if (!content) return <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có nội dung</div>;

                          // If raw HTML
                          if (selectedRevision.contentFormat === 'html' || (typeof content === 'string' && content.trim().startsWith('<'))) {
                            return (
                              <div 
                                style={{
                                  background: '#fff',
                                  padding: '20px',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  maxHeight: '440px',
                                  overflowY: 'auto',
                                  fontSize: '14px',
                                  lineHeight: 1.7,
                                  color: '#1e293b'
                                }}
                                dangerouslySetInnerHTML={{ __html: content }}
                              />
                            );
                          }

                          // If Tiptap JSON
                          try {
                            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                            const extractText = (node: any): string => {
                              if (!node) return '';
                              if (node.text) return node.text;
                              if (node.content && Array.isArray(node.content)) {
                                return node.content.map(extractText).join('\n');
                              }
                              return '';
                            };
                            const textPreview = extractText(parsed);
                            return (
                              <div style={{
                                background: '#fff',
                                padding: '20px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                maxHeight: '440px',
                                overflowY: 'auto',
                                fontSize: '14px',
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                                color: '#1e293b'
                              }}>
                                {textPreview || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có nội dung văn bản</span>}
                              </div>
                            );
                          } catch (e) {
                            return (
                              <pre style={{
                                background: '#fff',
                                padding: '16px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                maxHeight: '440px',
                                overflowY: 'auto',
                                fontSize: '12px',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {String(content).substring(0, 3000)}
                              </pre>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                💡 Khi bấm <strong>Khôi phục</strong>, dữ liệu bản cũ sẽ được nạp lại vào trình soạn thảo để bạn xem trước, sau đó bấm <strong>Update</strong> để lưu chính thức.
              </span>
              <button
                onClick={() => setShowRevisionsModal(false)}
                style={{
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal 
        isOpen={isMediaModalOpen} 
        onClose={() => setIsMediaModalOpen(false)} 
        onSelect={handleMediaSelected} 
        initialSearch={mediaInitialSearch}
      />
    </>
  );
}
