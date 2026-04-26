/**
 * Create a unique identifier for a file (tab)
 */
export function createFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
