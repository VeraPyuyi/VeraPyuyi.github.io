/**
 * Post Editor
 *
 * Full-screen editor for blog posts with BlockNote editor and frontmatter panel.
 * Supports Cmd+S save and unsaved changes warning.
 */

import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/shadcn/style.css';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FrontmatterEditorRef } from '@/components/FrontmatterEditor';
import { blocksToMarkdown, markdownToBlocks, postEditorSchema } from '@/components/post-editor/editor';
import { PostEditorCanvas } from '@/components/post-editor/PostEditorCanvas';
import { PostEditorHeader } from '@/components/post-editor/PostEditorHeader';
import { PostEditorSidebar, type SidebarTab } from '@/components/post-editor/PostEditorSidebar';
import { SidebarResizeHandle } from '@/components/post-editor/SidebarResizeHandle';
import { useSidebarResize } from '@/components/post-editor/useSidebarResize';
import { Button } from '@/components/ui/button';
import { useEditorHeadings } from '@/hooks';
import { readPost, writePost } from '@/lib/api';
import { DEV_SERVER_URL } from '@/lib/config';
import type { BlogSchema } from '@/types';

interface PostEditorProps {
  postId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function PostEditor({ postId, onClose, onSaved }: PostEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('frontmatter');

  const { sidebarWidth, isResizing, startResizing, handleResizeKeyDown } = useSidebarResize();

  const [frontmatter, setFrontmatter] = useState<BlogSchema>({ title: '' });
  const frontmatterRef = useRef<FrontmatterEditorRef>(null);

  const [previewContent, setPreviewContent] = useState('');

  // BlockNote editor with code block language support
  const editor = useCreateBlockNote({ schema: postEditorSchema });
  const initialContentLoaded = useRef(false);
  const initialFrontmatterLoaded = useRef(false);

  const headings = useEditorHeadings(editor);

  // Load post data
  useEffect(() => {
    async function loadPost() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await readPost(postId);
        setFrontmatter(data.frontmatter);
        initialFrontmatterLoaded.current = true;

        // Load content into editor
        if (data.content && editor) {
          await markdownToBlocks(editor, data.content);
          initialContentLoaded.current = true;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [postId, editor]);

  // Track content changes
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(() => {
      // Only mark as changed after initial content is loaded
      if (initialContentLoaded.current) {
        setHasUnsavedChanges(true);
      }
    });

    return unsubscribe;
  }, [editor]);

  // Handle frontmatter changes
  const handleFrontmatterChange = useCallback((fm: BlogSchema) => {
    setFrontmatter(fm);
    // Only mark as changed after initial frontmatter is loaded
    if (initialFrontmatterLoaded.current) {
      setHasUnsavedChanges(true);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      // Get markdown content
      const content = await blocksToMarkdown(editor);

      // Update the updated date
      const now = new Date();
      const updatedFrontmatter = {
        ...frontmatter,
        updated: now,
        // Set date if not present (new post)
        date: frontmatter.date || now,
      };

      await writePost(postId, updatedFrontmatter, content);

      setHasUnsavedChanges(false);
      toast.success('Post saved successfully');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setIsSaving(false);
    }
  }, [editor, frontmatter, postId, onSaved]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const previewSlug =
    frontmatter.link ||
    postId
      .replace(/\.mdx?$/, '')
      .split('/')
      .pop();
  const previewUrl = `${DEV_SERVER_URL}/post/${previewSlug}`;

  // Handle TOC navigation
  const handleTOCNavigate = useCallback(
    (blockId: string) => {
      if (!editor) return;

      // Set cursor position and focus
      editor.setTextCursorPosition(blockId);
      editor.focus();

      // Scroll block into view after cursor position is set
      // BlockNote renders blocks with data-id attribute
      requestAnimationFrame(() => {
        const blockElement = document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
          blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },
    [editor],
  );

  // Handle sidebar tab change
  const handleTabChange = useCallback(
    async (tab: SidebarTab) => {
      if (tab === 'preview' && editor) {
        // Convert blocks to markdown when switching to preview
        const md = await blocksToMarkdown(editor);
        setPreviewContent(md);
      }
      setSidebarTab(tab);
    },
    [editor],
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="ri:loader-4-line" className="size-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="ri:error-warning-line" className="size-12 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <PostEditorHeader
        title={frontmatter.title}
        postId={postId}
        previewUrl={previewUrl}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        showSidebar={showSidebar}
        onClose={handleClose}
        onSave={handleSave}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />

      <div className="flex flex-1 overflow-hidden">
        <PostEditorCanvas editor={editor} />

        {showSidebar && (
          <SidebarResizeHandle
            width={sidebarWidth}
            isResizing={isResizing}
            onMouseDown={startResizing}
            onKeyDown={handleResizeKeyDown}
          />
        )}

        {showSidebar && (
          <PostEditorSidebar
            width={sidebarWidth}
            activeTab={sidebarTab}
            frontmatter={frontmatter}
            frontmatterRef={frontmatterRef}
            headings={headings}
            previewContent={previewContent}
            onTabChange={handleTabChange}
            onFrontmatterChange={handleFrontmatterChange}
            onTOCNavigate={handleTOCNavigate}
          />
        )}
      </div>
    </div>
  );
}
