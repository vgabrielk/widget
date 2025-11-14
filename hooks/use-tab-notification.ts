'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseTabNotificationOptions {
  /**
   * The original page title to restore when notifications are cleared or tab is focused
   */
  originalTitle?: string;
  
  /**
   * The title to show when there are new notifications
   * @default "💬 Você tem novas mensagens..."
   */
  notificationTitle?: string;
  
  /**
   * Whether notifications are active (has unread messages)
   */
  hasNotifications: boolean;
  
  /**
   * Callback when title changes (optional, for tracking)
   */
  onTitleChange?: (title: string) => void;
}

/**
 * Hook to manage browser tab title notifications
 * Updates the tab title when there are new notifications and restores it when tab is focused
 */
export function useTabNotification({
  originalTitle,
  notificationTitle = '💬 Você tem novas mensagens...',
  hasNotifications,
  onTitleChange,
}: UseTabNotificationOptions) {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const getDocumentTitle = () => {
    if (originalTitle) return originalTitle;
    if (isBrowser) return document.title;
    return '';
  };

  const originalTitleRef = useRef<string>(getDocumentTitle());
  const isTitleChangedRef = useRef<boolean>(false);

  // Store original title on mount if not provided
  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    if (!originalTitle) {
      originalTitleRef.current = document.title;
    } else {
      originalTitleRef.current = originalTitle;
    }
  }, [originalTitle, isBrowser]);

  // Update title when notifications change
  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    if (hasNotifications && !isTitleChangedRef.current) {
      // Save current title if not already saved
      if (originalTitleRef.current === document.title || !isTitleChangedRef.current) {
        originalTitleRef.current = document.title;
      }
      
      document.title = notificationTitle;
      isTitleChangedRef.current = true;
      onTitleChange?.(notificationTitle);
    } else if (!hasNotifications && isTitleChangedRef.current) {
      // Restore original title when no notifications
      document.title = originalTitleRef.current;
      isTitleChangedRef.current = false;
      onTitleChange?.(originalTitleRef.current);
    }
  }, [hasNotifications, notificationTitle, onTitleChange, isBrowser]);

  // Restore title when tab gains focus
  const handleFocus = useCallback(() => {
    if (!isBrowser) {
      return;
    }
    if (isTitleChangedRef.current) {
      document.title = originalTitleRef.current;
      isTitleChangedRef.current = false;
      onTitleChange?.(originalTitleRef.current);
    }
  }, [onTitleChange, isBrowser]);

  // Set up focus listener
  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [handleFocus, isBrowser]);

  // Cleanup on unmount - restore original title
  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    return () => {
      if (isTitleChangedRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isBrowser]);

  /**
   * Manually restore the title (useful when user views notifications)
   */
  const restoreTitle = useCallback(() => {
    if (!isBrowser) {
      return;
    }
    if (isTitleChangedRef.current) {
      document.title = originalTitleRef.current;
      isTitleChangedRef.current = false;
      onTitleChange?.(originalTitleRef.current);
    }
  }, [onTitleChange, isBrowser]);

  return {
    restoreTitle,
    isTitleChanged: isTitleChangedRef.current,
  };
}

