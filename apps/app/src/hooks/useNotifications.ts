import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load notifications from localStorage
  useEffect(() => {
    const loadNotifications = () => {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Sort by createdAt, newest first
        const sorted = parsed.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sorted);
      }
      setIsLoading(false);
    };

    loadNotifications();
  }, []);

  // Save to localStorage whenever notifications change
  const saveNotifications = useCallback((updatedNotifications: Notification[]) => {
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    setNotifications(updatedNotifications);
  }, []);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    saveNotifications(updated);
  }, [notifications, saveNotifications]);

  // Toggle read/unread status
  const toggleNotificationRead = useCallback((notificationId: string) => {
    const updated = notifications.map(n =>
      n.id === notificationId ? { ...n, isRead: !n.isRead } : n
    );
    saveNotifications(updated);
  }, [notifications, saveNotifications]);

  // Mark specific notification as read
  const markAsRead = useCallback((notificationId: string) => {
    const updated = notifications.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    saveNotifications(updated);
  }, [notifications, saveNotifications]);

  // Add new notification (for future real-time functionality)
  const addNotification = useCallback((notification: Notification) => {
    const updated = [notification, ...notifications];
    saveNotifications(updated);
  }, [notifications, saveNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAllAsRead,
    toggleNotificationRead,
    markAsRead,
    addNotification,
  };
};
