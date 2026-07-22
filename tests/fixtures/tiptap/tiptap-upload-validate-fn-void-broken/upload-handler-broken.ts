import { Extension } from '@tiptap/core';

export interface FileUploadOptions {
  onUpload: (file: File) => Promise<string>;
  validateFn?: (file: File) => void;
  allowedTypes?: string[];
}

function handleFileUpload(file: File, options: FileUploadOptions) {
  const { validateFn, onUpload } = options;
  // validateFn called as a bare statement — return value silently discarded
  validateFn(file);
  return onUpload(file);
}

export { handleFileUpload };
