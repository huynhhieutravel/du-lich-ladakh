import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

/**
 * Extended Image node that supports alignment and caption attributes.
 * Renders as <figure> with <figcaption> if caption exists.
 */
export const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: element => element.tagName === 'IMG' ? element.getAttribute('src') : element.querySelector('img')?.getAttribute('src'),
      },
      alt: {
        default: null,
        parseHTML: element => element.tagName === 'IMG' ? element.getAttribute('alt') : element.querySelector('img')?.getAttribute('alt'),
      },
      title: {
        default: null,
        parseHTML: element => element.tagName === 'IMG' ? element.getAttribute('title') : element.querySelector('img')?.getAttribute('title'),
      },
      align: {
        default: 'full',
        parseHTML: (element) => element.closest('figure')?.getAttribute('data-align') || element.getAttribute('data-align') || 'full',
        renderHTML: (attributes) => ({ 'data-align': attributes.align || 'full' }),
      },
      caption: {
        default: null,
        parseHTML: (element) => {
          const figure = element.tagName === 'FIGURE' ? element : element.closest('figure');
          if (figure) {
            const figcaption = figure.querySelector('figcaption');
            return figcaption?.innerHTML || null;
          }
          return null;
        }
      }
    };
  },
  
  parseHTML() {
    return [
      { 
        tag: 'figure',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (!node.querySelector('img')) return false;
          return null;
        }
      },
      { tag: 'figcaption', ignore: true },
      { tag: 'img' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, align, ...rest } = HTMLAttributes;
    
    if (caption) {
      return [
        'figure', 
        { 'data-align': align || 'full', class: 'image-figure' },
        ['img', mergeAttributes(this.options.HTMLAttributes, rest)],
        ['figcaption', { class: 'image-caption' }, caption]
      ];
    }

    return ['img', mergeAttributes(this.options.HTMLAttributes, { 'data-align': align || 'full', ...rest })];
  },
});
