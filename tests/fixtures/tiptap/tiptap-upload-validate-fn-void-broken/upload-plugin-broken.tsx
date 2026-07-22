import { Node } from '@tiptap/core';

export interface ImageUploadOptions {
  validateFn?: (file: File) => void;
  onUpload: (file: File) => Promise<unknown>;
  maxSize?: number;
}

function createImageUpload({ validateFn, onUpload }: ImageUploadOptions) {
  return (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.error('Not an image');
    }
    // Return value is discarded — file validation never blocks uploads
    validateFn?.(file);
    return onUpload(file);
  };
}

export default createImageUpload;
