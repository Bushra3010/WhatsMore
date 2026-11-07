'use client';
// Media area entry: Status/stories, demo calls, Communities, Files/Cloud. Registers screens and actions
// in lib/registry. See PORTING.md.
import { tabs, overlays, register } from '@/lib/registry';
import { StatusTab, StoryOverlay, openStatus, openMyStatus, addStatusModal, voiceStatusModal, storyReply } from './status';
import { CallsTab, CallOverlay, startCall, endCall, callLinkModal, scheduleMeetingModal } from './calls';
import { CommunitiesTab, newCommunityModal, addGroupToCommunity } from './communities';
import { FilesTab, allFiles, storageUsed, parseFileQuery } from './files';
import { LightboxOverlay, viewMedia } from './lightbox';

export * from './hooks';

tabs.status = StatusTab;
tabs.calls = CallsTab;
tabs.communities = CommunitiesTab;
tabs.files = FilesTab;
overlays.story = StoryOverlay;
overlays.call = CallOverlay;
overlays.lightbox = LightboxOverlay;

register({
  startCall, endCall, openStatus, openMyStatus, addStatusModal, voiceStatusModal, storyReply, callLinkModal, scheduleMeetingModal,
  viewMedia, newCommunityModal, addGroupToCommunity, allFiles, storageUsed, parseFileQuery,
});
