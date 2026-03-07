import type { Post, ProfileConfig } from '@/types';

export const generateProfileConfig = (post: Post | null): ProfileConfig => {
  if (!post) return getDefaultConfig();

  const type = post.type;

  // Base configuration - components that are common across types
  const baseConfig = {
    itemType: type,
    navigation: 'tabs' as const,
    components: {
      text: true,
      mediaGallery: true,
      comments: true,
      shareButtons: true,
      // Everything else defaults to false
      eventFunctions: false,
      crowdfunding: false,
      members: false,
      comingEvents: false,
      projects: false,
      quests: false,
      badges: false,
      contactInfo: false
    }
  };

  // Type-specific component activation
  switch (type) {
    case 'person':
      return {
        ...baseConfig,
        components: {
          ...baseConfig.components,
          contactInfo: true,
          badges: true,
          projects: true,
          comingEvents: true
        }
      };

    case 'event':
      return {
        ...baseConfig,
        components: {
          ...baseConfig.components,
          eventFunctions: true,
          members: false // Events show participants in eventFunctions
        }
      };

    case 'project':
      return {
        ...baseConfig,
        components: {
          ...baseConfig.components,
          members: true,
          crowdfunding: !!post.crowdfunding, // Only if crowdfunding data exists
          comingEvents: true
        }
      };

    case 'quest':
      return {
        ...baseConfig,
        components: {
          ...baseConfig.components,
          quests: true
        }
      };

    case 'offer':
      return {
        ...baseConfig,
        components: {
          ...baseConfig.components,
          contactInfo: true
        }
      };

    default:
      return baseConfig;
  }
};

export const getDefaultConfig = (): ProfileConfig => ({
  itemType: 'event',
  navigation: 'tabs' as const,
  components: {
    text: true,
    mediaGallery: true,
    eventFunctions: false,
    comments: true,
    crowdfunding: false,
    members: false,
    comingEvents: false,
    projects: false,
    quests: false,
    badges: false,
    contactInfo: false,
    shareButtons: true
  }
});
