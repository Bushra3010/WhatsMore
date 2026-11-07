/* eslint-disable */
// @ts-nocheck -- static seed data
import type { AppState } from './types';

// Starting state for a new install. There are no made-up people, chats, stories or calls: everything
// in Chats, Status and Calls comes from real WHATSMORE accounts (Supabase). The super-app service
// sections (Pay, Marketplace, Business …) keep their sample content.

/** Sunrise Bakery: a sample shop in the Marketplace (its chat is created when you open the shop). */
export const BAKERY = {
      id: 'c_bakery', name: 'Sunrise Bakery', username: 'sunrisebakery', about: 'Fresh bakes every morning 🥐', color: '#f4511e', isContact: true, online: true, emoji: '🥐',
      business: {
        category: 'Bakery', address: '12 MG Road, Hyderabad 500001', hours: 'Mon–Sat · 9:00 AM – 9:00 PM', website: 'sunrisebakery.example',
        payments: 'WHATSMORE Pay · UPI · Cash on delivery', verified: true,
      },
    };

export function makeSeed(): AppState {
  const now = Date.now();
  const jan = (day, hr, min) => new Date(new Date().getFullYear(), 0, day, hr, min).getTime();
  const catalog = {
    c_bakery: [
      { id: 'p1', name: 'Chocolate Truffle Cake (1 kg)', price: 650, emoji: '🎂', bg: 'linear-gradient(135deg,#5d3a1a,#b97a46)', desc: 'Rich Belgian chocolate, layered with ganache.', stock: true },
      { id: 'p2', name: 'Butter Croissant', price: 90, emoji: '🥐', bg: 'linear-gradient(135deg,#f6d365,#fda085)', desc: 'Flaky, golden, baked every morning.', stock: true },
      { id: 'p3', name: 'Sourdough Loaf', price: 220, emoji: '🍞', bg: 'linear-gradient(135deg,#c79081,#dfa579)', desc: '48-hour fermented country loaf.', stock: true },
      { id: 'p4', name: 'Cupcake Box (6)', price: 360, emoji: '🧁', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', desc: 'Assorted flavours, perfect for parties.', stock: false },
    ],
  };

  return {
    version: 2,
    me: { id: 'me', name: '', username: '', about: 'Hey there! I am using WHATSMORE.', color: '#1565d8' },
    contacts: [], directory: [], catalog, chats: [], communities: [], statuses: [], calls: [],
    myStatus: { items: [] },
    payments: [
      { id: 'pay1', dir: 'out', amount: 18500, with: 'Ramesh Kumar', note: 'INV-2041 · Website work', t: jan(16, 16, 40) },
    ],
    wallet: 25000,
    signature: null,
    mod: {},
    devices: [
      { id: 'd_this', kind: 'devices', name: 'This device', where: '', t: now, current: true },
    ],
    scheduled: [],
    settings: {
      theme: 'light', enterSend: true, lockPin: null, plan: 'free',
      privacy: { lastSeen: 'contacts', photo: 'everyone', about: 'contacts', status: 'contacts', readReceipts: true, findByUsername: 'everyone', chatRequests: true },
      security: { twoStep: true, passkeys: false, biometric: false, deviceAlerts: true },
      devices: { syncHistory: true, biometricLink: false },
      aiMemory: true, aiPerms: { chats: true, files: true, location: false, contacts: true },
      profile: 'personal',
      notify: { messages: true, calls: true, payments: true, business: true, marketplace: false, community: true, ai: true, security: true, services: true },
      wellbeing: { focus: false, quiet: true, quietFrom: '22:00', quietTo: '07:00', summary: true, reminder: true, limit: 120 },
      emergency: { contacts: [], message: 'I need help. This is an emergency. My current location is being shared with my emergency contacts.' },
      sessions: [
        { id: 's1', name: 'This device', where: '', current: true, t: now },
      ],
    },
  };
}
