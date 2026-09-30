import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MediaCardView } from './MediaCardView';

/**
 * MediaCard node — A bordered card with image (left 33%) and editable text (right 67%).
 * JSON structure: { type: "mediaCard", attrs: { src, alt }, content: [paragraph nodes] }
 */
export const MediaCard = Node.create({
  name: 'mediaCard',
  group: 'block',
  content: 'block+',
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="media-card"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'media-card' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaCardView);
  },
});
