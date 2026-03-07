import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Post } from '@/types';

const VIEWS = ['feed', 'map', 'calendar'] as const;
export type View = typeof VIEWS[number];

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathSegment = location.pathname.split('/')[1] || 'feed';
  const currentView: View = VIEWS.includes(pathSegment as View) ? (pathSegment as View) : 'feed';

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postToOpenOnMap, setPostToOpenOnMap] = useState<Post | null>(null);
  const [postToOpenOnCalendar, setPostToOpenOnCalendar] = useState<Post | null>(null);
  const [navigationSource, setNavigationSource] = useState<string | null>(null);
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);

  const selectPost = (post: Post) => {
    setSelectedPost(post);
  };

  const closeDetail = () => {
    setSelectedPost(null);
    setPostToOpenOnMap(null);

    if (navigationSource === 'feed' && currentView === 'feed') {
      setTimeout(() => {
        const scrollElement = document.querySelector('.overflow-y-auto');
        if (scrollElement) {
          scrollElement.scrollTop = previousScrollPosition;
        }
        setNavigationSource(null);
      }, 100);
    }
  };

  const switchToMap = (post: Post) => {
    setPostToOpenOnMap(post);
    navigate('/map');
  };

  const switchToMapFromProfile = (post: Post) => {
    const scrollElement = document.querySelector('.overflow-y-auto');
    if (scrollElement) {
      setPreviousScrollPosition(scrollElement.scrollTop);
    }
    if (currentView === 'feed') setNavigationSource('feed');
    else if (currentView === 'calendar') setNavigationSource('calendar');

    setPostToOpenOnMap(post);
    navigate('/map');
  };

  const switchToCalendar = (post: Post) => {
    setPostToOpenOnCalendar(post);
    navigate('/calendar');
  };

  const backToFeed = () => {
    navigate('/feed');
    setPostToOpenOnMap(null);
  };

  const backToCalendar = () => {
    navigate('/calendar');
    setPostToOpenOnMap(null);
  };

  const changeView = (view: string) => {
    closeDetail();
    setNavigationSource(null);
    navigate(`/${view}`);
  };

  return {
    currentView,
    selectedPost,
    setSelectedPost,
    postToOpenOnMap,
    postToOpenOnCalendar,
    navigationSource,
    selectPost,
    closeDetail,
    switchToMap,
    switchToMapFromProfile,
    switchToCalendar,
    backToFeed,
    backToCalendar,
    changeView,
    showBackToFeed: navigationSource === 'feed',
    showBackToCalendar: navigationSource === 'calendar',
  };
}
