import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';

export const FaqBlockView: React.FC<any> = ({ node, updateAttributes, deleteNode, selected }) => {
  const questions: { q: string; a: string }[] = node.attrs.questions || [];

  const updateQuestion = (index: number, field: 'q' | 'a', value: string) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    updateAttributes({ questions: newQuestions });
  };

  const addQuestion = () => {
    updateAttributes({ questions: [...questions, { q: 'Câu hỏi mới?', a: '' }] });
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      deleteNode(); // Remove the entire block if it's the last question
    } else {
      const newQuestions = questions.filter((_, i) => i !== index);
      updateAttributes({ questions: newQuestions });
    }
  };

  return (
    <NodeViewWrapper 
      className="faq-block-view"
      style={{
        border: selected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        background: '#f8fafc'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{width: '20px', height: '20px', color: '#3b82f6'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          FAQ (Câu hỏi thường gặp)
        </h3>
        <button 
          onClick={deleteNode} 
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          title="Xóa FAQ Block"
        >
          Xóa Khối
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map((item, index) => (
          <div key={index} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <strong style={{ color: '#3b82f6', width: '20px' }}>Q.</strong>
              <input
                type="text"
                value={item.q}
                onChange={e => updateQuestion(index, 'q', e.target.value)}
                placeholder="Câu hỏi..."
                style={{ flex: 1, border: 'none', outline: 'none', fontWeight: 600, color: '#1e293b', fontSize: '14px' }}
              />
              <button 
                onClick={() => removeQuestion(index)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                title="Xóa câu hỏi này"
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <strong style={{ color: '#10b981', width: '20px' }}>A.</strong>
              <textarea
                value={item.a}
                onChange={e => updateQuestion(index, 'a', e.target.value)}
                placeholder="Câu trả lời..."
                rows={2}
                style={{ flex: 1, border: 'none', outline: 'none', color: '#475569', fontSize: '14px', resize: 'vertical' }}
              />
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={addQuestion}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '10px',
          background: '#fff',
          border: '1px dashed #cbd5e1',
          borderRadius: '6px',
          color: '#64748b',
          cursor: 'pointer',
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <svg style={{width: '16px', height: '16px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        Thêm câu hỏi
      </button>
    </NodeViewWrapper>
  );
};
