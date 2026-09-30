import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FaqBlockView } from './FaqBlockView';

/**
 * FaqBlock node — An interactive block to add Frequently Asked Questions.
 * Uses a React NodeView to render accordion-style inputs.
 */
export const FaqBlock = Node.create({
  name: 'faqBlock',
  group: 'block',
  atom: true, // Content managed via React state/attrs, not Tiptap schema
  draggable: true,

  addAttributes() {
    return {
      questions: {
        default: [{ q: 'Nhập câu hỏi...', a: 'Nhập câu trả lời...' }],
        parseHTML: element => {
          const raw = element.getAttribute('data-questions');
          return raw ? JSON.parse(raw) : [{ q: '', a: '' }];
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="faq-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const questions = HTMLAttributes.questions || [];
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'faq-block', 
        'data-questions': JSON.stringify(questions) 
      }),
      // Fallback HTML inside for non-JS parsers (if any)
      ['div', { class: 'faq-fallback-html' },
        ...questions.map((item: any) => 
          ['details', {}, 
            ['summary', {}, item.q],
            ['p', {}, item.a]
          ]
        )
      ]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FaqBlockView);
  },
});
