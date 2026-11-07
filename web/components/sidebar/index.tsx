'use client';
// Area entry: Chats tab, sidebar pages (new chat, new group, archived, locked, starred) and the chat info
// drawer. Registers screens and cross-area actions in lib/registry. See PORTING.md.
import { tabs, pages, drawers, register } from '@/lib/registry';
import { openGuards } from '@/lib/actions';
import { ui } from '@/lib/state';
import { ChatsTab, chatItemMenu, chatsMenu, openNewChat, openMsg } from './ChatList';
import { NewChatPage, NewGroupPage, ArchivedPage, LockedPage, StarredPage, allStarred } from './pages';
import { InfoDrawer, StarredDrawer } from './Drawer';
import {
  withPin, setPinModal, toggleLock, openLocked, deleteChat, clearChat, toggleBlock, exitGroup, disappearModal, verifyModal,
  addMemberModal, inviteLinkModal, editDescModal, memberMenu, chatPicker, forwardModal, startSecretChat, secretPickModal,
} from './chatActions';

tabs.chats = ChatsTab;
pages.newchat = NewChatPage;
pages.newgroup = NewGroupPage;
pages.archived = ArchivedPage;
pages.locked = LockedPage;
pages.starred = StarredPage;
pages['set-starred'] = StarredPage;
drawers.info = InfoDrawer;
drawers.starred = StarredDrawer;

// Locked chats ask for the PIN before opening (features.js openChat).
openGuards.push((ch, proceed) => {
  if (ch.locked && !ui.unlocked.includes(ch.id)) {
    withPin(() => { if (!ui.unlocked.includes(ch.id)) ui.unlocked.push(ch.id); proceed(); });
    return false;
  }
});

register({
  chatItemMenu, chatsMenu, withPin, setPinModal, toggleLock, openLocked, deleteChat, clearChat, toggleBlock, exitGroup,
  disappearModal, verifyModal, addMemberModal, inviteLinkModal, editDescModal, memberMenu, chatPicker, forwardModal,
  startSecretChat, secretPickModal, openNewChat, openMsg, allStarred,
});
