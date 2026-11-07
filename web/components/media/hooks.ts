'use client';
// Extension hooks of the media area (status/stories, calls) for the live layer.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Chat, Contact, Dict } from '@/lib/types';

/** One person's stories in the viewer (original `ui.story.owners[i]`). */
export interface StoryOwner { ref: Dict | null; who: Partial<Contact> & { id: string; name: string }; items: Dict[]; mine?: boolean }

/** Called after a new item was added to My status (live layer uploads it). */
export const statusPostedHooks: ((item: Dict) => void)[] = [];
/** Called whenever a story item is shown in the viewer (live layer records the view). */
export const storyViewHooks: ((owner: StoryOwner, item: Dict) => void)[] = [];
/** Called after one of my status items was deleted (live layer deletes it for everyone). */
export const storyDeleteHooks: ((item: Dict) => void)[] = [];
/** Asked before replying to a story; return true when the reply was fully handled. */
export const storyReplyHooks: ((owner: StoryOwner, text: string) => boolean | Promise<boolean>)[] = [];
/** Asked before a demo call starts; return true when handled (real calls in live chats). */
export const startCallHooks: ((ch: Chat | null, video: boolean, opts: { room?: string; [k: string]: any }) => boolean)[] = [];
