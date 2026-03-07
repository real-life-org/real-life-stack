import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Post, MockUser, PostComment, ConvertedComment, ProfileData } from '@/types';

const calculateDistance = (lat1: number, lon1: number, lat2 = 52.52, lon2 = 13.40): string => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return `${distance.toFixed(1)} km`;
};

const convertReactions = (reactions: Record<string, number> | undefined) => {
  if (!reactions) return { likes: 0, hearts: 0 };

  let likes = 0;
  let hearts = 0;

  Object.entries(reactions).forEach(([emoji, count]) => {
    if (emoji === '❤️' || emoji === '💕' || emoji === '💖') {
      hearts += count;
    } else {
      likes += count;
    }
  });

  return { likes, hearts };
};

const formatRelativeTime = (dateString: string): string => {
  try {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: de
    });
  } catch {
    return 'vor kurzem';
  }
};

const convertComments = (comments: PostComment[] | undefined, users: Record<string, MockUser>): ConvertedComment[] => {
  if (!comments || !Array.isArray(comments)) return [];

  return comments.map(comment => {
    const author = users[comment.authorId];
    return {
      id: comment.id,
      author: {
        name: author?.name || 'Unbekannt',
        avatar: author?.avatar || null
      },
      time: formatRelativeTime(comment.createdAt),
      text: comment.text,
      replies: comment.replies && comment.replies.length > 0
        ? convertComments(comment.replies, users)
        : undefined
    };
  });
};

const convertEventDetails = (post: Post) => {
  if (!post.startTime) return null;

  const startDate = new Date(post.startTime);
  const endDate = post.endTime ? new Date(post.endTime) : null;

  return {
    startDate: startDate.toISOString().split('T')[0],
    startTime: startDate.toTimeString().slice(0, 5),
    endDate: endDate ? endDate.toISOString().split('T')[0] : startDate.toISOString().split('T')[0],
    endTime: endDate ? endDate.toTimeString().slice(0, 5) : null,
    participants: post.eventDetails?.participants || []
  };
};

const getUserProjects = (userId: string, allPosts: Post[]) => {
  return allPosts
    .filter(p => p.type === 'project' && p.members?.includes(userId))
    .map(p => ({
      id: p.id,
      name: p.title,
      image: p.media?.[0]?.url
    }));
};

const getUserComingEvents = (userId: string, allPosts: Post[]) => {
  return allPosts
    .filter(p => {
      if (p.type !== 'event') return false;
      if (p.authorId === userId) return true;
      if (p.eventDetails?.participants?.some(part => part.id === userId)) return true;
      return false;
    })
    .map(p => ({
      id: p.id,
      name: p.title,
      date: p.startTime,
      image: p.media?.[0]?.url
    }))
    .slice(0, 5);
};

export const postToProfileData = (post: Post | null, users: Record<string, MockUser>, allPosts: Post[] = []): ProfileData | null => {
  if (!post) return null;

  const author = users[post.authorId] || {} as MockUser;
  const location = post.location || null;

  const banner = post.type === 'person'
    ? (author.banner || post.media?.[1]?.url)
    : (post.media?.[0]?.url || author.banner);

  const galleryImages = post.media
    ?.filter(m => m.url !== banner)
    .map(m => m.url) || [];

  const baseData: ProfileData = {
    type: post.type,
    name: post.title,
    avatar: post.type === 'person' ? author.avatar : (post.media?.[0]?.url || author.avatar),
    banner: banner,
    address: location?.name || '',
    distance: location ? calculateDistance(location.lat, location.lon) : null,
    text: post.content,
    images: galleryImages,
    reactions: post.reactions || {},
    comments: convertComments(post.comments, users),
    location: location
  };

  switch (post.type) {
    case 'person':
      baseData.contactInfo = post.contactInfo || author.contactInfo || null;
      baseData.badges = post.badges || author.badges || [];
      baseData.projects = getUserProjects(post.authorId, allPosts);
      baseData.comingEvents = getUserComingEvents(post.authorId, allPosts);
      break;

    case 'event':
      baseData.eventDetails = convertEventDetails(post);
      break;

    case 'quest':
      baseData.questDetails = post.questDetails || null;
      break;

    case 'project':
      baseData.members = post.members?.map(userId => ({
        id: userId,
        name: users[userId]?.name || 'Unbekannt',
        avatar: users[userId]?.avatar || null
      })) || [];
      baseData.crowdfunding = post.crowdfunding || null;
      break;

    case 'offer':
      baseData.contactInfo = post.contactInfo || author.contactInfo || null;
      break;
  }

  return baseData;
};

export const getPostBanner = (post: Post): string | null => {
  return post.media?.[0]?.url || null;
};

export { convertReactions };
