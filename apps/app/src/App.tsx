import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import BottomMenu from '@/components/layout/BottomMenu';
import MainContent from '@/components/layout/MainContent';
import { Toaster } from '@/components/ui/toaster';
import { Button, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@real-life-stack/toolkit';
import SmartPostWidget, { POST_TYPES } from '@/components/SmartPostWidget';
import { initializeMockData } from '@/data/mockData';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Plus } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useMessages } from '@/hooks/useMessages';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useComposer } from '@/hooks/useComposer';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useScrollFab } from '@/hooks/useScrollFab';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import MessagingWidget from '@/components/messages/MessagingWidget';

initializeMockData();

function App() {
  const isMobile = useIsMobile();
  const nav = useAppNavigation();
  const composer = useComposer(nav.currentView);
  const fabVisible = useScrollFab(nav.currentView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);

  const { notifications, unreadCount, markAllAsRead, toggleNotificationRead, markAsRead } = useNotifications();
  const {
    conversations, messages, totalUnreadCount,
    activeConversationId, setActiveConversationId,
    sendMessage, markConversationAsRead,
    toggleReaction, togglePin, toggleMute,
    createDirectConversation, createGroupConversation,
  } = useMessages();

  const handleViewChange = (view: string) => {
    composer.setIsOpen(false);
    nav.changeView(view);
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setNotificationPanelOpen(false);
    if (notification.postId) {
      const posts = JSON.parse(localStorage.getItem('posts') || '[]') || [];
      const post = posts.find(p => p.id === notification.postId);
      if (post) {
        if (post.location && post.type === 'event') {
          nav.switchToMap(post);
        } else {
          if (nav.currentView !== 'feed') nav.changeView('feed');
          nav.selectPost(post);
        }
      }
    }
  };

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    if (id) markConversationAsRead(id);
  };

  const handleCloseMessaging = () => {
    setIsMessagingOpen(false);
    setTimeout(() => setActiveConversationId(null), 200);
  };

  return (
    <>
      <div className="h-dvh bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 overflow-hidden flex flex-col">
        <Navbar
          currentView={nav.currentView}
          setCurrentView={handleViewChange}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          notificationPanelOpen={notificationPanelOpen}
          setNotificationPanelOpen={setNotificationPanelOpen}
          onNotificationClick={handleNotificationClick}
          markAllAsRead={markAllAsRead}
          toggleNotificationRead={toggleNotificationRead}
          isMobile={isMobile}
          totalUnreadCount={totalUnreadCount}
          isMessagingOpen={isMessagingOpen}
          onOpenMessaging={() => setIsMessagingOpen(true)}
        />

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-1 min-h-0 pt-16">
            <AnimatePresence>
              {sidebarOpen && (
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              )}
            </AnimatePresence>

            <motion.div
              className="flex-1 flex flex-col min-h-0"
              animate={{ marginLeft: sidebarOpen ? '320px' : '0px' }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
            >
              <Routes>
                <Route path="/" element={<Navigate to="/feed" replace />} />
                {['feed', 'map', 'calendar'].map((view) => (
                  <Route key={view} path={`/${view}`} element={
                    <MainContent
                      currentView={nav.currentView}
                      onSelectPost={nav.selectPost}
                      selectedPost={nav.selectedPost}
                      onCloseDetail={nav.closeDetail}
                      postToOpenOnMap={nav.postToOpenOnMap}
                      postToOpenOnCalendar={nav.postToOpenOnCalendar}
                      setSelectedPost={nav.setSelectedPost}
                      onCreatePost={composer.createPost}
                      onCreateEvent={composer.createEvent}
                      onSwitchToMapView={nav.switchToMap}
                      onSwitchToMapViewFromProfile={nav.switchToMapFromProfile}
                      onSwitchToCalendarView={nav.switchToCalendar}
                      onBackToFeed={nav.backToFeed}
                      onBackToCalendar={nav.backToCalendar}
                      showBackToFeed={nav.showBackToFeed}
                      showBackToCalendar={nav.showBackToCalendar}
                    />
                  } />
                ))}
                <Route path="*" element={<Navigate to="/feed" replace />} />
              </Routes>
            </motion.div>
          </div>
        </div>

        <BottomMenu currentView={nav.currentView} setCurrentView={handleViewChange} />

        {/* Messaging Dialog */}
        <Dialog open={isMessagingOpen} onOpenChange={(open) => { if (!open) handleCloseMessaging(); }}>
          <DialogContent
            className="max-w-full sm:max-w-full w-screen h-dvh border-none bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-0 shadow-none rounded-none m-0"
            showCloseButton={false}
          >
            <motion.div className="h-full overflow-y-auto flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <MessagingWidget
                conversations={conversations} messages={messages}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onSendMessage={sendMessage} onReact={toggleReaction}
                onTogglePin={togglePin} onToggleMute={toggleMute}
                onCreateDirect={createDirectConversation}
                onCreateGroup={createGroupConversation}
                onClose={handleCloseMessaging}
              />
            </motion.div>
          </DialogContent>
        </Dialog>

        {/* Mobile notification panel */}
        {isMobile && (
          <NotificationPanel
            notifications={notifications} isOpen={notificationPanelOpen}
            onClose={() => setNotificationPanelOpen(false)}
            onMarkAllRead={markAllAsRead} onToggleRead={toggleNotificationRead}
            onNotificationClick={handleNotificationClick} isMobile={true}
          />
        )}

        {/* Composer Dialog + FAB */}
        <Dialog open={composer.isOpen} onOpenChange={(open) => { if (!open) composer.close(false); }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: fabVisible ? 1 : 0.3 }}
            transition={{ duration: 1 }} className="fixed bottom-24 md:bottom-4 right-4 z-50"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-500 text-white shadow-[0_10px_30px_rgba(79,70,229,0.45)] hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-600">
                  <Plus className="w-6 h-6" />
                  <span className="sr-only">Eintragstyp auswählen</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={12} className="mb-3 min-w-[220px]">
                {Object.values(POST_TYPES).map((type) => (
                  <DropdownMenuItem key={type} onSelect={() => composer.launch(type)} className="cursor-pointer">
                    {type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
          <DialogContent
            className="max-w-full sm:max-w-full w-screen h-dvh border-none bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-0 shadow-none rounded-none m-0"
            showCloseButton={false}
          >
            <motion.div className="h-full overflow-y-auto flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <DndProvider backend={HTML5Backend}>
                <SmartPostWidget
                  key={`${composer.postType}-${composer.initialData ? composer.initialData.startTime : 'no-data'}`}
                  initialPostType={composer.postType}
                  initialData={composer.initialData}
                  onClose={composer.close}
                />
              </DndProvider>
            </motion.div>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </>
  );
}

export default App;
