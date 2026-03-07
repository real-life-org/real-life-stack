import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Type, Image as ImageIcon, MapPin, Calendar, Users, Tag, Globe, Lock, Send, Trash2, Eye, Edit, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MediaFile {
  id: string;
  url: string;
  name: string;
}

interface DateRange {
  start: string;
  end?: string;
}

interface LocationData {
  address?: string;
  location?: string;
  isOnline?: boolean;
}

interface WidgetData {
  title?: string;
  text?: string;
  media?: MediaFile[];
  date?: DateRange;
  location?: LocationData;
  people?: string[];
  tags?: string[];
  [key: string]: unknown;
}

interface InitialData {
  startTime?: string;
  endTime?: string;
}

interface PostData {
  id: number;
  postType: string;
  isPublic: boolean;
  data: WidgetData;
  createdAt: string;
  location?: LocationData;
}

interface SmartPostWidgetProps {
  onClose?: (success?: boolean, post?: Record<string, unknown> | null) => void;
  initialPostType?: string;
  initialData?: InitialData | null;
}

import TitleWidget from '@/components/widgets/TitleWidget';
import TextWidget from '@/components/widgets/TextWidget';
import MediaWidget from '@/components/widgets/MediaWidget';
import LocationWidget from '@/components/widgets/LocationWidget';
import DateWidget from '@/components/widgets/DateWidget';
import PeopleWidget from '@/components/widgets/PeopleWidget';
import TagsWidget from '@/components/widgets/TagsWidget';

const POST_TYPES: Record<string, string> = {
  POST: 'Post',
  EVENT: 'Veranstaltung',
  GROUP: 'Projekt',
  AD: 'Anzeige',
};

const WIDGET_TYPES = {
  TITLE: 'title',
  TEXT: 'text',
  MEDIA: 'media',
  LOCATION: 'location',
  DATE: 'date',
  PEOPLE: 'people',
  TAGS: 'tags',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WIDGET_CONFIG: Record<string, { component: React.ComponentType<any>; icon: React.ComponentType<{ className?: string }> | null; label: string }> = {
  [WIDGET_TYPES.TITLE]: { component: TitleWidget, icon: Type, label: 'Titel' },
  [WIDGET_TYPES.TEXT]: { component: TextWidget, icon: null, label: 'Beschreibung' },
  [WIDGET_TYPES.MEDIA]: { component: MediaWidget, icon: ImageIcon, label: 'Medien' },
  [WIDGET_TYPES.LOCATION]: { component: LocationWidget, icon: MapPin, label: 'Ort' },
  [WIDGET_TYPES.DATE]: { component: DateWidget, icon: Calendar, label: 'Datum' },
  [WIDGET_TYPES.PEOPLE]: { component: PeopleWidget, icon: Users, label: 'Personen' },
  [WIDGET_TYPES.TAGS]: { component: TagsWidget, icon: Tag, label: 'Tags' },
};

const POST_TYPE_DEFAULT_WIDGETS: Record<string, string[]> = {
  [POST_TYPES.POST]: [WIDGET_TYPES.TEXT],
  [POST_TYPES.EVENT]: [WIDGET_TYPES.TITLE, WIDGET_TYPES.TEXT, WIDGET_TYPES.DATE, WIDGET_TYPES.LOCATION, WIDGET_TYPES.PEOPLE],
  [POST_TYPES.GROUP]: [WIDGET_TYPES.TITLE, WIDGET_TYPES.TEXT, WIDGET_TYPES.PEOPLE],
  [POST_TYPES.AD]: [WIDGET_TYPES.TITLE, WIDGET_TYPES.TEXT, WIDGET_TYPES.TAGS],
};

const WIDGET_ORDER = [WIDGET_TYPES.TITLE, WIDGET_TYPES.TEXT, WIDGET_TYPES.MEDIA, WIDGET_TYPES.DATE, WIDGET_TYPES.LOCATION, WIDGET_TYPES.PEOPLE, WIDGET_TYPES.TAGS];

const SmartPostWidget: React.FC<SmartPostWidgetProps> = ({ onClose, initialPostType = POST_TYPES.POST, initialData = null }) => {
  const [postType, setPostType] = useState(initialPostType);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(
    POST_TYPE_DEFAULT_WIDGETS[initialPostType] || POST_TYPE_DEFAULT_WIDGETS[POST_TYPES.POST]
  );
  const [widgetData, setWidgetData] = useState<WidgetData>(() => {
    // Pre-fill widgetData with initialData if provided
    if (initialData) {
      const data: WidgetData = {};
      // Pre-fill date widget if startTime and endTime are provided
      if (initialData.startTime && initialData.endTime) {
        data.date = {
          start: initialData.startTime,
          end: initialData.endTime,
        };
      }
      return data;
    }
    return {};
  });
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (initialPostType && initialPostType !== postType) {
      setPostType(initialPostType);
    }
  }, [initialPostType]);

  // Handle initialData changes
  useEffect(() => {
    if (initialData) {
      const newData: WidgetData = { ...widgetData };
      // Pre-fill date widget if startTime and endTime are provided
      if (initialData.startTime && initialData.endTime) {
        newData.date = {
          start: initialData.startTime,
          end: initialData.endTime,
        };
      }
      setWidgetData(newData);
    }
  }, [initialData]);

  useEffect(() => {
    const newWidgets = POST_TYPE_DEFAULT_WIDGETS[postType];
    setActiveWidgets(newWidgets);

    const newWidgetData: WidgetData = {};
    // Keep data for all widgets, not just the active ones for the new post type
    Object.keys(widgetData).forEach(type => {
        newWidgetData[type] = widgetData[type];
    });
    setWidgetData(newWidgetData);
  }, [postType]);

  const toggleWidget = useCallback((widgetType: string) => {
    setActiveWidgets(prev => {
      const isRemoving = prev.includes(widgetType);
      if (isRemoving) {
        return prev.filter(w => w !== widgetType);
      } else {
        return [...prev, widgetType].sort((a, b) => WIDGET_ORDER.indexOf(a) - WIDGET_ORDER.indexOf(b));
      }
    });
  }, []);

  const updateWidgetData = useCallback((widgetType: string, data: unknown | ((prev: unknown) => unknown)) => {
    setWidgetData(prev => {
      const newData = typeof data === 'function' ? data(prev[widgetType]) : data;
      return { ...prev, [widgetType]: newData };
    });
  }, []);

  const handleTextMentions = useCallback((mentions: string[], type: string) => {
    const widgetType = type === '@' ? WIDGET_TYPES.PEOPLE : WIDGET_TYPES.TAGS;
    if (!activeWidgets.includes(widgetType)) {
      toggleWidget(widgetType);
    }
    updateWidgetData(widgetType, (prevData: string[] = []) => {
      const currentItems = new Set(prevData);
      mentions.forEach(item => currentItems.add(item));
      return Array.from(currentItems);
    });
  }, [activeWidgets, toggleWidget, updateWidgetData]);

  const handleSubmit = () => {
    const post: PostData = {
      id: Date.now(),
      postType,
      isPublic,
      data: widgetData,
      createdAt: new Date().toISOString(),
    };

    // Add location for events if available
    if (postType === POST_TYPES.EVENT && widgetData.location) {
      post.location = widgetData.location;
    }
    
    console.log("Submitting post:", post);
    const existingPosts: PostData[] = JSON.parse(localStorage.getItem('socialPosts') || '[]');
    localStorage.setItem('socialPosts', JSON.stringify([post, ...existingPosts]));
    toast({ title: "Eintrag erstellt!", description: "Dein Eintrag wurde erfolgreich gespeichert." });
    
    // Clear form
    setPostType(POST_TYPES.POST);
    setActiveWidgets(POST_TYPE_DEFAULT_WIDGETS[POST_TYPES.POST]);
    setWidgetData({});
    
    // Call onClose with success flag and post data
    if (typeof onClose === 'function') {
      onClose(true, post as unknown as Record<string, unknown>);
    }
  };

  const handleCancel = () => {
    if (typeof onClose === 'function') {
      onClose(false);
    }
  };

  const getWidgetLabel = (type: string) => {
    if (type === WIDGET_TYPES.TITLE && postType === POST_TYPES.GROUP) return "Name";
    if (type === WIDGET_TYPES.PEOPLE) {
      if (postType === POST_TYPES.EVENT) return "Teilnehmer einladen";
      if (postType === POST_TYPES.GROUP) return "Mitglieder einladen";
    }
    return WIDGET_CONFIG[type].label;
  };

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700 overflow-x-auto">
        <div className="max-w-3xl mx-auto p-4 flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleCancel} 
            className="text-slate-300 hover:text-white mr-4"
          >
            <X className="w-5 h-5" />
          </Button>
        <div className="flex-1 flex items-center justify-left">
          {showPreview ? (
            <h2 className="text-lg font-semibold text-white">{postType} - Vorschau</h2>
          ) : (
            <div className="inline-flex items-center space-x-1 bg-white/10 backdrop-blur-sm rounded-full p-1">
              {Object.values(POST_TYPES).map(type => (
                <button
                  key={type}
                  onClick={() => setPostType(type)}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                    postType === type
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={() => setShowPreview(!showPreview)} className="text-sm text-slate-300 hover:text-white ml-4 flex-shrink-0">
          {showPreview ? <Edit className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showPreview ? 'Bearbeiten' : 'Vorschau'}
        </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
        <AnimatePresence mode="wait">
          <motion.div
            key={showPreview ? 'preview' : 'form'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
          {showPreview ? (
            <div className="max-w-3xl mx-auto px-4 py-6 prose prose-invert prose-headings:text-slate-100 prose-p:text-slate-300 prose-a:text-purple-400 prose-strong:text-white">
              {widgetData.title && <h1>{widgetData.title}</h1>}
              {widgetData.text && <ReactMarkdown remarkPlugins={[remarkGfm]}>{widgetData.text}</ReactMarkdown>}
              {widgetData.media && widgetData.media.length > 0 && (
                <div className="not-prose grid grid-cols-3 gap-2 my-4">
                  {widgetData.media.map((file: MediaFile) => <img key={file.id} src={file.url} alt={file.name} className="rounded-lg object-cover aspect-square" />)}
                </div>
              )}
              {widgetData.date && widgetData.date.start && <p><strong>Datum:</strong> {new Date(widgetData.date.start).toLocaleString()}{widgetData.date.end && ` - ${new Date(widgetData.date.end).toLocaleString()}`}</p>}
              {widgetData.location && (widgetData.location.address || widgetData.location.location) && <p><strong>Ort:</strong> {widgetData.location.isOnline ? <a href={widgetData.location.location}>{widgetData.location.location}</a> : widgetData.location.address}</p>}
              {widgetData.people && widgetData.people.length > 0 && <p><strong>Personen:</strong> {widgetData.people.join(', ')}</p>}
              {widgetData.tags && widgetData.tags.length > 0 && <p><strong>Tags:</strong> {widgetData.tags.map(t => `#${t}`).join(' ')}</p>}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              <AnimatePresence>
                {WIDGET_ORDER.map(widgetType => {
                  if (!activeWidgets.includes(widgetType)) return null;
                  
                  const WidgetComponent = WIDGET_CONFIG[widgetType].component;
                  const isTextWidget = widgetType === WIDGET_TYPES.TEXT;

                  return (
                    <motion.div
                      key={widgetType}
                      layout
                      initial={{ opacity: 0, height: 0, y: -20 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="relative"
                    >
                      <WidgetComponent
                        value={widgetData[widgetType]}
                        onChange={(data) => updateWidgetData(widgetType, data)}
                        label={getWidgetLabel(widgetType)}
                        onMention={handleTextMentions}
                        availableWidgets={WIDGET_ORDER.filter(w => !activeWidgets.includes(w) && WIDGET_CONFIG[w].icon)}
                        onToggleWidget={toggleWidget}
                        isTextWidget={isTextWidget}
                        autoFocus={isTextWidget}
                      />
                       {!isTextWidget && !POST_TYPE_DEFAULT_WIDGETS[postType].includes(widgetType) && (
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-slate-700/50" onClick={() => toggleWidget(widgetType)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="bg-slate-900/50 border-t border-slate-700">
        <div className="max-w-3xl mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Switch id="visibility-switch" checked={isPublic} onCheckedChange={setIsPublic} />
          <Label htmlFor="visibility-switch" className="flex items-center text-sm text-slate-300 cursor-pointer">
            {isPublic ? <Globe className="w-4 h-4 mr-2 text-green-400" /> : <Lock className="w-4 h-4 mr-2 text-red-400" />}
            {isPublic ? 'Öffentlich' : 'Privat'}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              className="text-slate-300 border-slate-600 hover:bg-slate-700/50"
            >
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                <Send className="w-4 h-4 mr-2" />
                {postType === POST_TYPES.POST ? 'Posten' : 'Erstellen'}
            </Button>
        </div>
        </div>
      </div>
    </div>
  );
};

export { POST_TYPES };

export default SmartPostWidget;
