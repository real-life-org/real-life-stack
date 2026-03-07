export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  AUDIO: 'audio',
  VIDEO: 'video',
} as const;

export const CONVERSATION_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
} as const;

export const ATTACHMENT_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  OTHER: 'other',
} as const;

export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

// Common emoji reactions
export const COMMON_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// Helper to get MIME type category
export const getMimeTypeCategory = (mimeType: string | undefined) => {
  if (!mimeType) return ATTACHMENT_TYPES.OTHER;

  if (mimeType.startsWith('image/')) return ATTACHMENT_TYPES.IMAGE;
  if (mimeType.startsWith('video/')) return ATTACHMENT_TYPES.VIDEO;
  if (mimeType.startsWith('audio/')) return ATTACHMENT_TYPES.AUDIO;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return ATTACHMENT_TYPES.DOCUMENT;
  }

  return ATTACHMENT_TYPES.OTHER;
};

// Helper to format file size
export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
