import { Node, mergeAttributes } from '@tiptap/core';

export const WpGallery = Node.create({
  name: 'wpGallery',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [
      {
        tag: 'ul.wp-block-gallery',
      },
      {
        tag: 'figure.wp-block-gallery',
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { class: 'wp-block-gallery' }), 0];
  },
});
