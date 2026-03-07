export const NOTIFICATION_TYPES = {
  NEW_REACTION: 'new_reaction',
  NEW_COMMENT: 'new_comment',
  COMMENT_REPLY: 'comment_reply',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

interface NotificationData {
  postTitle: string
  [key: string]: unknown
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { icon: string; color: string; template: (data: NotificationData) => string }> = {
  [NOTIFICATION_TYPES.NEW_REACTION]: {
    icon: '❤️',
    color: 'text-pink-400',
    template: (data) => `hat auf deinen Post "${data.postTitle}" reagiert`,
  },
  [NOTIFICATION_TYPES.NEW_COMMENT]: {
    icon: '💬',
    color: 'text-blue-400',
    template: (data) => `hat deinen Post "${data.postTitle}" kommentiert`,
  },
  [NOTIFICATION_TYPES.COMMENT_REPLY]: {
    icon: '↩️',
    color: 'text-purple-400',
    template: () => `hat auf deinen Kommentar geantwortet`,
  },
};
