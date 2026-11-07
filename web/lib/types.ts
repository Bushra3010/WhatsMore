// Data model for WHATSMORE. Types are deliberately open (index signatures): the demo stores many
// message/module shapes, and the live layer adds fields. Core fields are typed so the common paths
// are checked.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Id = string;
export type Dict<T = any> = Record<string, T>;

export interface Business { category?: string; address?: string; hours?: string; website?: string; payments?: string; verified?: boolean; [k: string]: any }

export interface Contact {
  id: Id;
  name: string;
  username: string;
  about?: string;
  color?: string;
  emoji?: string;
  lang?: string;
  isContact?: boolean;
  online?: boolean;
  lastSeen?: number;
  blocked?: boolean;
  business?: Business;
  cloud?: boolean;
  badge?: string | null;
  [k: string]: any;
}

export interface Message {
  id: Id;
  type: string;
  from: Id | 'me' | 'system';
  t: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  reactions?: Dict<string[]>;
  text?: string;
  caption?: string;
  replyTo?: Id;
  edited?: boolean;
  [k: string]: any;
}

export interface Chat {
  id: Id;
  type: 'direct' | 'group';
  contactId?: Id;
  name?: string;
  emoji?: string;
  color?: string;
  members?: Id[];
  admins?: Id[];
  messages: Message[];
  unread?: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  locked?: boolean;
  secret?: boolean;
  left?: boolean;
  cloud?: boolean;
  sbId?: string;
  [k: string]: any;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system' | string;
  enterSend: boolean;
  lockPin: string | null;
  plan: string;
  privacy: Dict;
  security: Dict;
  profile: string;
  notify: Dict<boolean>;
  wellbeing: Dict;
  sessions: Dict[];
  [k: string]: any;
}

export interface AppState {
  version: 1;
  me: Contact & { cloudId?: string; email?: string };
  contacts: Contact[];
  directory: Contact[];
  catalog: Dict<Dict[]>;
  chats: Chat[];
  communities: Dict[];
  statuses: Dict[];
  calls: Dict[];
  myStatus: { items: Dict[] };
  payments: Dict[];
  wallet: number;
  signature: any;
  mod: Dict;
  devices: Dict[];
  scheduled: Dict[];
  settings: Settings;
  [k: string]: any;
}

/** Transient, per-tab UI state (never saved). */
export interface UIState {
  tab: string;
  page: string | null;
  view: string | null;
  active: Id | null;
  filter: string;
  search: string;
  ncQuery: string;
  ngName: string;
  ngQuery: string;
  ngPick: Id[];
  memQuery: string;
  memLimit: number;
  replyTo: Id | null;
  editing: Id | null;
  chatSearch: string | null;
  searchIdx: number;
  drawer: string | null;
  unlocked: Id[];
  typing: Dict<string>;
  emojiOpen: boolean;
  emojiTab: string;
  draft: Dict<string>;
  filesCat: string;
  filesQuery: string;
  blobs: string[];
  [k: string]: any;
}
