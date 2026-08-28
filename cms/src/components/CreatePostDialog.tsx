/** Dialog for creating a taxonomy-free article. */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type CreatePostFormData, createPostSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (postId: string) => void;
}

export function CreatePostDialog({ open, onOpenChange, onSuccess }: CreatePostDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: '', keywords: '', draft: true },
  });

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: CreatePostFormData) => {
    setIsSubmitting(true);
    try {
      const keywords = data.keywords
        ?.split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean);
      const response = await fetch('/api/cms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title, keywords, draft: data.draft }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create post');
      }
      const result = await response.json();
      close();
      onSuccess(result.postId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Article</DialogTitle>
          <DialogDescription>The article is created directly in the flat article directory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="font-medium text-sm">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              {...register('title')}
              className={cn(
                'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                errors.title && 'border-destructive',
              )}
            />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="keywords" className="font-medium text-sm">
              SEO Keywords
            </label>
            <input
              id="keywords"
              {...register('keywords')}
              placeholder="keyword1, keyword2"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('draft')} className="size-4 rounded border-input" />
            Create as draft
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create Article'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
