import type { WalineConfig, WalineEmojiPresets } from '@/lib/config/types';

export const WALINE_EMOJI_PRESETS: WalineEmojiPresets[] = [
  'https://unpkg.com/@waline/emojis@1.2.0/weibo',
  'https://unpkg.com/@waline/emojis@1.2.0/bilibili',
  'https://unpkg.com/@waline/emojis@1.2.0/qq',
  'https://unpkg.com/@waline/emojis@1.2.0/alus',
];

export const WALINE_SITE_DEFAULTS = {
  meta: [],
  requiredMeta: [],
  login: 'force',
  wordLimit: [1, 2000],
  pageSize: 10,
  search: false,
  reaction: false,
  commentSorting: 'latest',
  noCopyright: false,
  comment: false,
  pageview: false,
} satisfies Partial<WalineConfig>;

export function resolveWalinePath(contentId: string | undefined, pathname: string): string {
  const stableId = contentId?.trim();
  return stableId || pathname;
}

export function getWalineLocaleOverrides(locale: string): Record<string, string> {
  if (locale.toLowerCase().startsWith('en')) {
    return {
      placeholder: 'Sign in with GitHub to leave a message. You can paste images or choose a sticker.',
      uploadImage: 'Upload image (auto-compressed)',
      uploading: 'Compressing image…',
      login: 'Sign in to comment',
      emoji: 'Stickers',
    };
  }

  return {
    placeholder: '使用 GitHub 登录后留言；可以粘贴图片或选择表情包。',
    uploadImage: '上传图片（自动压缩）',
    uploading: '正在压缩图片…',
    login: '登录后留言',
    emoji: '表情包',
  };
}
