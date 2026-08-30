import type { WalineImageUploader } from '@waline/client';

export const WALINE_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const WALINE_MAX_GIF_BYTES = 512 * 1024;
export const WALINE_MAX_OUTPUT_BYTES = 640 * 1024;
export const WALINE_MAX_IMAGE_EDGE = 1600;

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface UploadMessages {
  unsupported: string;
  sourceTooLarge: string;
  gifTooLarge: string;
  compressionFailed: string;
}

function getMessages(locale: string): UploadMessages {
  if (locale.toLowerCase().startsWith('en')) {
    return {
      unsupported: 'Please choose a JPEG, PNG, WebP, or GIF image.',
      sourceTooLarge: 'The original image must be smaller than 8 MB.',
      gifTooLarge: 'Animated GIFs must be smaller than 512 KB. Try a sticker from the emoji panel instead.',
      compressionFailed: 'This image could not be compressed safely. Please choose a smaller image.',
    };
  }

  return {
    unsupported: '请选择 JPEG、PNG、WebP 或 GIF 图片。',
    sourceTooLarge: '原始图片不能超过 8 MB。',
    gifTooLarge: '动态 GIF 不能超过 512 KB，也可以改用表情包面板中的贴图。',
    compressionFailed: '无法将这张图片安全压缩，请换一张更小的图片。',
  };
}

export function validateWalineImage(file: File, locale = 'zh-CN'): void {
  const messages = getMessages(locale);
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) throw new TypeError(messages.unsupported);
  if (file.size > WALINE_MAX_SOURCE_BYTES) throw new RangeError(messages.sourceTooLarge);
  if (file.type === 'image/gif' && file.size > WALINE_MAX_GIF_BYTES) throw new RangeError(messages.gifTooLarge);
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode image'));
      },
      'image/webp',
      quality,
    );
  });
}

async function compressImage(file: File, locale: string): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, WALINE_MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  let smallestBlob: Blob | null = null;

  for (let sizePass = 0; sizePass < 5; sizePass += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error(getMessages(locale).compressionFailed);

    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.86, 0.78, 0.7, 0.62]) {
      const blob = await canvasToBlob(canvas, quality);
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (blob.size <= WALINE_MAX_OUTPUT_BYTES) return fileToDataUrl(blob);
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  if (smallestBlob && smallestBlob.size <= WALINE_MAX_OUTPUT_BYTES) return fileToDataUrl(smallestBlob);
  throw new RangeError(getMessages(locale).compressionFailed);
}

export function createWalineImageUploader(locale: string): WalineImageUploader {
  return async (file) => {
    validateWalineImage(file, locale);
    if (file.type === 'image/gif') return fileToDataUrl(file);
    return compressImage(file, locale);
  };
}
