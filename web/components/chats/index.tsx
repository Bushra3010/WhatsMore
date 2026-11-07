'use client';
// Area entry: the open chat (main area). Registers the chat view, its timers and the cross-area actions.
import { mains, overlays, register } from '@/lib/registry';
import { openView } from '@/lib/nav';
import { ChatView } from './ChatView';
import { ChatTimers } from './Timers';
import { msgMenu, attachMenu, headMenu, aiWriteMenu, deleteMsgModal, reactInfoModal, openChatSearch } from './menus';
import {
  payModal, payRequest, pollModal, eventModal, shareContactModal, catalogModal, scheduleModal, scheduledListModal, aiSummaryModal,
  translateMsgModal, chatPrivacyModal, liveTranslateModal, locationModal, reportTargetModal, reportModal, reportUser, reportMessage,
  reportGroup, reportScam, reportScamProblem, enhanceImage, sendMedia,
} from './modals';
import { summarize, transcribeVoice, react, vote, jumpTo, runScheduled, sweepExpired, sendText, startRecording, stopRecording, playVoice, stopVoice } from './core';

mains.__chat = ChatView;
overlays.chatTimers = ChatTimers;

register({
  payModal, payRequest, pollModal, eventModal, shareContactModal, catalogModal, scheduleModal, scheduledListModal,
  locationModal, reportMessage, reportUser, reportModal, reportGroup, reportTarget: reportTargetModal, reportTargetModal, reportScam, reportScamProblem,
  translateMsgModal, msgMenu, attachMenu, headMenu, aiWriteMenu, aiSummaryModal, summarize, chatPrivacyModal, liveTranslateModal,
  deleteMsgModal, reactInfoModal, react, vote, enhanceImage, sendMedia, transcribeVoice, jumpTo, chatSearch: openChatSearch,
  runScheduled, sweepExpired, sendText, startRecording, stopRecording, playVoice, stopVoice, openView,
});
