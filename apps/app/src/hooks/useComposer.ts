import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '@/types';

const POST_TYPES = {
  POST: 'Post',
  EVENT: 'Event',
  QUEST: 'Quest',
  CROWDFUNDING: 'Crowdfunding',
};

export function useComposer(currentView: string) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [postType, setPostType] = useState(POST_TYPES.POST);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [previousView, setPreviousView] = useState(currentView);
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);

  const launch = (type: string, data: Record<string, unknown> | null = null) => {
    const scrollElement = document.querySelector('.overflow-y-auto');
    if (scrollElement) {
      setPreviousScrollPosition(scrollElement.scrollTop);
    }
    setPreviousView(currentView);
    setPostType(type);
    setInitialData(data);
    setIsOpen(true);
  };

  const createPost = () => launch(POST_TYPES.POST);

  const createEvent = (startTime: Date) => {
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const fmt = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${d}T${h}:${min}`;
    };

    launch(POST_TYPES.EVENT, { startTime: fmt(startTime), endTime: fmt(endTime) });
  };

  const close = (postCreated = false, postData: Record<string, unknown> | null = null) => {
    setIsOpen(false);
    setInitialData(null);

    if (postCreated && postData) {
      if (postData.postType === POST_TYPES.EVENT && (postData.data as Record<string, unknown>)?.location) {
        navigate('/map');
      } else if (postData.postType === POST_TYPES.EVENT) {
        navigate('/calendar');
      } else {
        navigate('/feed');
      }
    } else {
      navigate(`/${previousView}`);
      setTimeout(() => {
        const scrollElement = document.querySelector('.overflow-y-auto');
        if (scrollElement) {
          scrollElement.scrollTop = previousScrollPosition;
        }
      }, 100);
    }
  };

  return {
    isOpen,
    postType,
    initialData,
    launch,
    createPost,
    createEvent,
    close,
    setIsOpen,
  };
}
