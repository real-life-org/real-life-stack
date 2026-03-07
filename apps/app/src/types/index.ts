export interface MockUser {
  name: string
  avatar: string
  banner?: string
  bio?: string
  contactInfo?: ContactInfo
  badges?: string[]
}

export interface ContactInfo {
  email?: string
  phone?: string
  website?: string
}

export interface MediaItem {
  type: 'image' | 'video'
  url: string
}

export interface PostComment {
  id: string
  authorId: string
  text: string
  createdAt: string
  replies?: PostComment[]
}

export interface EventParticipant {
  id: string
  name: string
  status?: 'confirmed' | 'invited' | 'declined'
}

export interface EventDetails {
  participants?: EventParticipant[]
}

export interface QuestDetails {
  difficulty: string
  timeRequired: string
  reward: string
}

export interface CrowdfundingDonation {
  amount: number
  donor: string
  date: string
}

export interface Crowdfunding {
  raised: number
  goal: number
  donors: number
  donations: CrowdfundingDonation[]
}

export interface Post {
  id: string
  type: 'person' | 'event' | 'project' | 'offer' | 'quest'
  authorId: string
  createdAt: string
  title: string
  content: string
  location?: Location
  reactions?: Record<string, number>
  comments?: PostComment[]
  media?: MediaItem[]
  startTime?: string
  endTime?: string
  eventDetails?: EventDetails
  questDetails?: QuestDetails
  crowdfunding?: Crowdfunding
  members?: string[]
  contactInfo?: ContactInfo
  badges?: string[]
  projects?: string[]
  comingEvents?: string[]
}

export interface Location {
  lat: number
  lon: number
  name: string
}

export interface ConvertedEventDetails {
  startDate: string
  startTime: string
  endDate: string
  endTime: string | null
  participants: EventParticipant[]
}

export interface ProfileData {
  type: string
  name: string
  avatar: string | null
  banner: string | undefined
  address: string
  distance: string | null
  text: string
  images: string[]
  reactions: Record<string, number>
  comments: ConvertedComment[]
  location: Location | null
  contactInfo?: ContactInfo | null
  badges?: string[]
  projects?: { id: string; name: string; image?: string }[]
  comingEvents?: { id: string; name: string; date?: string; image?: string }[]
  eventDetails?: ConvertedEventDetails | null
  questDetails?: QuestDetails | null
  members?: { id: string; name: string; avatar: string | null }[]
  crowdfunding?: Crowdfunding | null
}

export interface ConvertedComment {
  id: string
  author: { name: string; avatar: string | null }
  time: string
  text: string
  replies?: ConvertedComment[]
}

export interface ProfileConfig {
  itemType: string
  navigation: 'tabs' | 'dots'
  components: {
    text: boolean
    mediaGallery: boolean
    comments: boolean
    shareButtons: boolean
    eventFunctions: boolean
    crowdfunding: boolean
    members: boolean
    comingEvents: boolean
    projects: boolean
    quests: boolean
    badges: boolean
    contactInfo: boolean
  }
}

export interface Notification {
  id: string
  type: string
  userId: string
  targetUserId: string
  postId: string
  commentId?: string
  data: {
    userName: string
    userAvatar: string
    postTitle: string
    emoji?: string
    commentText?: string
  }
  isRead: boolean
  createdAt: string
}

export interface MessageAttachment {
  id: string
  type: string
  url: string
  name: string
  size: number
  mimeType: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  type: string
  attachments: MessageAttachment[]
  reactions: Record<string, string[]>
  replyTo: string | null
  isRead: boolean
  isDelivered: boolean
  createdAt: string
  updatedAt: string
  isEdited: boolean
}

export interface LastMessage {
  content: string
  senderId: string
  createdAt: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string
  description?: string
  participants: string[]
  avatar: string
  lastMessage: LastMessage | null
  unreadCount: number
  isPinned: boolean
  isMuted: boolean
  createdAt: string
  updatedAt: string
}
