import React from 'react';
import PostEditor from './PostEditor.tsx';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  initialPostId?: string | null;
}

export default function PostEditorWrapper({ initialPostId }: Props) {
  return (
    <ErrorBoundary>
      <PostEditor initialPostId={initialPostId} />
    </ErrorBoundary>
  );
}
