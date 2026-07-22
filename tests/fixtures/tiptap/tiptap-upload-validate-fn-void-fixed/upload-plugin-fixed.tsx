import { Node } from '@tiptap/core';

export interface ImageUploadOptions {
  validateFn?: (file: File) => boolean;
  onUpload: (file: File) => Promise<unknown>;
  maxSize?: number;
}

function createImageUpload({ validateFn, onUpload }: ImageUploadOptions) {
  return (file: File) => {
    if (validateFn && !validateFn(file)) {
      console.error('File rejected by validateFn');
      return;
    }
    return onUpload(file);
  };
}

export default createImageUpload;
