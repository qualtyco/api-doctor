import { Extension } from '@tiptap/core';

export interface FileUploadOptions {
  onUpload: (file: File) => Promise<string>;
  validateFn?: (file: File) => boolean;
}

// Adversarial: validateFn return value IS captured and used as a guard
function handleFileUpload(file: File, options: FileUploadOptions) {
  const { validateFn, onUpload } = options;
  const ok = validateFn?.(file);
  if (!ok) {
    throw new Error('File failed validation');
  }
  return onUpload(file);
}

export { handleFileUpload };
