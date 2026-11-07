// Seed data for the WHATSMORE demo. Regenerated on first load or after "Reset demo".
window.WM_SEED = function () {
  const now = Date.now();
  const m = 60000, h = 60 * m, d = 24 * h;
  let n = 0;
  const id = () => 'm' + (++n) + Math.random().toString(36).slice(2, 6);
  const M = (from, text, t, extra = {}) => ({ id: id(), from, type: 'text', text, t, status: 'read', reactions: {}, ...extra });
  const jan = (day, hr, min) => new Date(new Date().getFullYear(), 0, day, hr, min).getTime();
  const aug = (day, hr, min) => new Date(new Date().getFullYear(), 7, day, hr, min).getTime();

  const contacts = [
    { id: 'c_siva', name: 'Siva', username: 'sivabhai', about: 'Building WHATSMORE 🚀', color: '#7c4dff', lang: 'te', isContact: true, online: true },
    { id: 'c_priya', name: 'Priya Sharma', username: 'priya.s', about: 'Travel • Chai • Code', color: '#e91e63', lang: 'hi', isContact: true, online: false, lastSeen: now - 25 * m },
    { id: 'c_ramesh', name: 'Ramesh Kumar', username: 'ramesh_k', about: 'Freelance web developer', color: '#ff9800', isContact: true, online: false, lastSeen: now - 3 * h },
    { id: 'c_ananya', name: 'Ananya Rao', username: 'ananya', about: 'Designer 🎨', color: '#009688', isContact: true, online: true },
    { id: 'c_arjun', name: 'Arjun Mehta', username: 'arjun.m', about: 'Security engineer 🔐', color: '#3f51b5', isContact: true, online: false, lastSeen: now - 50 * m },
    { id: 'c_mom', name: 'Mom ❤️', username: 'amma', about: 'Family first', color: '#d81b60', isContact: true, online: false, lastSeen: now - 10 * m, emoji: '👩' },
    {
      id: 'c_bakery', name: 'Sunrise Bakery', username: 'sunrisebakery', about: 'Fresh bakes every morning 🥐', color: '#f4511e', isContact: true, online: true, emoji: '🥐',
      business: {
        category: 'Bakery', address: '12 MG Road, Hyderabad 500001', hours: 'Mon–Sat · 9:00 AM – 9:00 PM', website: 'sunrisebakery.example',
        payments: 'WHATSMORE Pay · UPI · Cash on delivery', verified: true,
      },
    },
    { id: 'c_kyc', name: 'KYC Update Desk', username: 'kyc.update.desk', about: 'Customer support', color: '#757575', isContact: false, online: false, lastSeen: now - 30 * m },
  ];

  const directory = [
    { id: 'u_kiran', name: 'Kiran Tech', username: 'techguru_kiran', about: 'Android dev · Hyderabad', color: '#00897b' },
    { id: 'u_meera', name: 'Meera Designs', username: 'meera.designs', about: 'UI/UX designer · Bengaluru', color: '#8e24aa' },
    { id: 'u_rahul', name: 'Rahul Verma', username: 'rahulv', about: 'Product manager', color: '#5e35b1' },
    { id: 'u_fatima', name: 'Fatima Sheikh', username: 'fatima.codes', about: 'Full-stack · Open source', color: '#c2185b' },
  ];

  const catalog = {
    c_bakery: [
      { id: 'p1', name: 'Chocolate Truffle Cake (1 kg)', price: 650, emoji: '🎂', bg: 'linear-gradient(135deg,#5d3a1a,#b97a46)', desc: 'Rich Belgian chocolate, layered with ganache.', stock: true },
      { id: 'p2', name: 'Butter Croissant', price: 90, emoji: '🥐', bg: 'linear-gradient(135deg,#f6d365,#fda085)', desc: 'Flaky, golden, baked every morning.', stock: true },
      { id: 'p3', name: 'Sourdough Loaf', price: 220, emoji: '🍞', bg: 'linear-gradient(135deg,#c79081,#dfa579)', desc: '48-hour fermented country loaf.', stock: true },
      { id: 'p4', name: 'Cupcake Box (6)', price: 360, emoji: '🧁', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', desc: 'Assorted flavours, perfect for parties.', stock: false },
    ],
  };

  const enc = (t) => ({ id: id(), type: 'system', text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.', t, from: 'system' });

  const chats = [
    {
      id: 'ch_siva', type: 'direct', contactId: 'c_siva', unread: 2, pinned: true,
      messages: [
        enc(now - 2 * d),
        M('c_siva', 'నమస్తే అన్నా! WHATSMORE demo ఎలా ఉంది?', now - 2 * d + 5 * m, { tr: 'Hello brother! How is the WHATSMORE demo going?' }),
        M('me', 'Going great! Building the chat UI now 🚀', now - 2 * d + 9 * m),
        M('c_siva', 'సూపర్! రేపు మీటింగ్ 11 గంటలకు, మర్చిపోవద్దు.', now - 40 * m, { tr: "Super! Meeting tomorrow at 11 o'clock, don't forget." }),
        { id: id(), from: 'c_siva', type: 'voice', dur: 14, t: now - 38 * m, status: 'read', reactions: {} },
      ],
    },
    {
      id: 'ch_ananya', type: 'direct', contactId: 'c_ananya', unread: 2,
      messages: [
        enc(now - 4 * d),
        M('me', 'Did you finish the new logo drafts?', now - 4 * d),
        M('c_ananya', 'Yes! Sending them tomorrow 🎨', now - 4 * d + 3 * m, { reactions: { '❤️': ['me'] } }),
        { id: id(), from: 'c_ananya', type: 'image', art: { emoji: '🌅', bg: 'linear-gradient(180deg,#ff9a56 0%,#ff6a88 45%,#5b247a 100%)' }, caption: 'Look at this sunset 🌅', t: now - 70 * m, status: 'read', reactions: {} },
        M('c_ananya', 'Tank Bund, Hyderabad 😍', now - 69 * m),
      ],
    },
    {
      id: 'ch_trip', type: 'group', name: 'Weekend Trip 🏖️', emoji: '🏖️', color: '#0288d1', members: ['c_priya', 'c_arjun', 'c_ramesh'], admins: ['me', 'c_priya'],
      description: 'Goa · 10–12 Oct · Budget trip 😎', unread: 4,
      messages: [
        enc(now - 3 * d),
        { id: id(), from: 'system', type: 'system', text: 'Priya Sharma created group "Weekend Trip 🏖️"', t: now - 3 * d },
        M('c_arjun', 'Hotel booked for the trip ✅ Sharing the receipt', now - 3 * d + 2 * h),
        { id: id(), from: 'c_arjun', type: 'doc', name: 'Receipt_Hotel_Booking_Sep2026.pdf', size: 186000, pages: 1, ext: 'pdf', t: now - 3 * d + 2 * h + m, status: 'read', reactions: { '🙌': ['c_priya', 'me'] } },
        { id: id(), from: 'c_arjun', type: 'image', art: { emoji: '🏝️', bg: 'linear-gradient(180deg,#4facfe 0%,#00f2fe 55%,#f6d365 100%)' }, caption: 'This is where we are staying 😍', t: now - 2 * d, status: 'read', reactions: {} },
        { id: id(), from: 'c_priya', type: 'poll', question: 'Which beach first?', options: ['Baga', 'Palolem', 'Anjuna'], votes: { 0: ['c_priya', 'c_arjun'], 1: ['c_ramesh'], 2: [] }, multi: false, t: now - 5 * h, status: 'read', reactions: {} },
        { id: id(), from: 'c_priya', type: 'payment', kind: 'request', amount: 3000, note: 'Villa – split 4 ways', split: { total: 12000, people: 4 }, status: 'pending', paidBy: ['c_priya', 'c_arjun'], t: now - 4 * h, reactions: {} },
        M('c_priya', 'Total for the villa was ₹12,000 — please pay your share by Friday 🙏', now - 4 * h + m),
        M('c_arjun', "Don't forget sunscreen ☀️", now - 2 * h),
        M('c_ramesh', 'Leaving at 7 AM sharp on Saturday. Decided: we take my car 🚗', now - 25 * m),
      ],
    },
    {
      id: 'ch_bakery', type: 'direct', contactId: 'c_bakery', unread: 0,
      messages: [
        enc(now - 3 * d),
        M('c_bakery', 'Welcome to Sunrise Bakery 🥐 How can we help you today? Ask about hours, prices, delivery — or place an order from our catalogue.', now - 3 * d, { bot: true }),
      ],
    },
    {
      id: 'ch_ramesh', type: 'direct', contactId: 'c_ramesh', unread: 0,
      messages: [
        enc(jan(12, 9, 0)),
        M('c_ramesh', "Here's the invoice for the January website work", jan(14, 10, 12)),
        { id: id(), from: 'c_ramesh', type: 'doc', name: 'Invoice_INV-2041_Jan.pdf', size: 248000, pages: 2, ext: 'pdf', t: jan(14, 10, 13), status: 'read', reactions: {} },
        M('me', 'Received, thanks! Will process the payment this week.', jan(14, 11, 2)),
        { id: id(), from: 'me', type: 'payment', kind: 'send', amount: 18500, note: 'INV-2041 · Website work', status: 'paid', t: jan(16, 16, 40), reactions: { '🙏': ['c_ramesh'] } },
        { id: id(), from: 'c_ramesh', type: 'doc', name: 'Invoice_INV-2188_Aug.pdf', size: 231000, pages: 2, ext: 'pdf', t: aug(22, 14, 5), status: 'read', reactions: {} },
        M('c_ramesh', 'Hi! Are we still on for the review on Monday?', now - d - 2 * h),
        M('me', 'Yes, 10 AM works for me.', now - d - h, { status: 'read' }),
        { id: id(), from: 'c_ramesh', type: 'sticker', text: '👍', t: now - d - 50 * m, status: 'read', reactions: {} },
        M('c_ramesh', 'Sharing the agreement for the new website project. Please review and sign 🙏', now - 2 * h),
        { id: id(), from: 'c_ramesh', type: 'signreq', doc: { name: 'Freelance_Agreement_2026.docx', ext: 'docx', size: 42000 }, signers: ['me'], note: 'I have already signed. Your signature is needed to start.', status: 'pending', t: now - 2 * h + m, reactions: {} },
      ],
    },
    {
      id: 'ch_kyc', type: 'direct', contactId: 'c_kyc', unread: 2,
      messages: [
        enc(now - 40 * m),
        M('c_kyc', 'Dear customer, your bank account will be blocked today. Update your KYC immediately at http://bit.ly/kyc-upd8 and share the OTP you receive to verify.', now - 40 * m),
        M('c_kyc', 'Congratulations! You have won ₹25,00,000 in the lucky draw 🎉 Pay a ₹999 processing fee to claim your reward within 2 hours.', now - 38 * m),
      ],
    },
    {
      id: 'ch_project', type: 'group', name: 'Project WHATSMORE 🚀', emoji: '🚀', color: '#1565d8', members: ['c_siva', 'c_arjun', 'c_ananya'], admins: ['me', 'c_siva'],
      description: 'Core team · MVP planning · More Than Chat.', unread: 0,
      messages: [
        enc(now - 6 * d),
        { id: id(), from: 'system', type: 'system', text: 'You created group "Project WHATSMORE 🚀"', t: now - 6 * d },
        M('c_siva', 'Team, MVP scope: private chat, calls, groups, username login. Everything else in phase 2.', now - 26 * h),
        M('c_arjun', 'Encryption plan: Signal protocol for 1:1 chats, Sender Keys for groups. Decided ✅', now - 25 * h),
        M('c_ananya', 'UI designs ready by Friday 🎨', now - 24 * h),
        { id: id(), from: 'c_siva', type: 'doc', name: 'WHATSMORE_PRD_v2.pdf', size: 1240000, pages: 18, ext: 'pdf', t: now - 23 * h, status: 'read', reactions: {} },
        M('c_siva', 'Please review the PRD by Wednesday. Important: investor demo on Monday at 4 PM 📢', now - 23 * h + m, { pinned: true }),
        M('me', "On it. I'll prepare the demo build.", now - 22 * h, { status: 'read' }),
      ],
    },
    {
      id: 'ch_priya', type: 'direct', contactId: 'c_priya', unread: 0,
      messages: [
        enc(now - 5 * d),
        M('c_priya', 'कल की ट्रिप के लिए तैयार हो?', now - 5 * h, { tr: 'Are you ready for the trip?' }),
        M('me', 'Yes! Packing tonight 🎒', now - 5 * h + 4 * m),
        M('c_priya', 'ठीक है, मैं सुबह 7 बजे पिक करूँगी 🚗', now - 5 * h + 6 * m, { tr: "Okay, I'll pick you up at 7 in the morning 🚗" }),
      ],
    },
    {
      id: 'ch_family', type: 'group', name: 'Family ❤️', emoji: '🏡', color: '#c2185b', members: ['c_mom', 'c_siva', 'c_ananya'], admins: ['c_mom'],
      description: 'Our happy family 🏡', unread: 0, muted: true,
      messages: [
        enc(now - 9 * d),
        M('c_mom', 'Sunday lunch at home everyone 🍛 1 PM', now - d - 5 * h),
        M('c_siva', "I'll bring sweets 🍬", now - d - 4 * h),
        M('c_ananya', 'Count me in!', now - d - 4 * h + 10 * m),
      ],
    },
    {
      id: 'ch_arjun', type: 'direct', contactId: 'c_arjun', unread: 0, archived: true,
      messages: [
        enc(now - 12 * d),
        M('c_arjun', 'Security audit checklist for WHATSMORE is ready', now - 8 * d),
        { id: id(), from: 'c_arjun', type: 'doc', name: 'Security_Audit_Checklist.xlsx', size: 64000, ext: 'xlsx', t: now - 8 * d + m, status: 'read', reactions: {} },
        M('me', 'Legend 🙌', now - 8 * d + 5 * m),
      ],
    },
    {
      id: 'ch_mom', type: 'direct', contactId: 'c_mom', unread: 0,
      messages: [
        enc(now - 20 * d),
        M('c_mom', 'Did you eat?', now - 6 * h),
        M('me', 'Yes amma 😄', now - 6 * h + 2 * m),
        M('c_mom', 'Call me when you are free', now - 6 * h + 3 * m),
      ],
    },
    // Community groups
    {
      id: 'ch_gv_ann', type: 'group', name: 'Announcements', community: 'cm_gv', emoji: '📢', color: '#2e7d32', members: ['c_ramesh', 'c_priya'], admins: ['c_ramesh'], readOnly: true, unread: 1,
      description: 'Only admins can post here.',
      messages: [
        enc(now - 30 * d),
        M('c_ramesh', '📢 Water supply will be off this Sunday, 10 AM – 2 PM, for tank cleaning. Please store water.', now - 3 * h),
      ],
    },
    {
      id: 'ch_gv_garden', type: 'group', name: 'Gardening Club 🌱', community: 'cm_gv', emoji: '🌱', color: '#558b2f', members: ['c_priya', 'c_ananya'], admins: ['c_priya'], unread: 0,
      messages: [
        enc(now - 30 * d),
        M('c_ananya', 'Tomato saplings available near Block C 🍅', now - 2 * d),
      ],
    },
  ];

  const communities = [
    { id: 'cm_gv', name: 'Green Valley Residents', emoji: '🏘️', color: '#2e7d32', description: '240 families · Green Valley Apartments, Hyderabad', groups: ['ch_gv_ann', 'ch_gv_garden'] },
  ];

  const statuses = [
    { contactId: 'c_ananya', viewed: false, items: [
      { type: 'image', art: { emoji: '🌅', bg: 'linear-gradient(180deg,#ff9a56 0%,#ff6a88 45%,#5b247a 100%)' }, caption: 'Weekend vibes', t: now - 2 * h },
      { type: 'text', text: 'New logo drafts coming soon 👀', bg: '#009688', t: now - h },
    ] },
    { contactId: 'c_siva', viewed: false, items: [
      { type: 'text', text: 'Building WHATSMORE 🚀\nMore Than Chat.', bg: '#5e35b1', t: now - 3 * h },
    ] },
    { contactId: 'c_bakery', viewed: false, business: true, items: [
      { type: 'text', text: '🎂 20% OFF on all cakes this weekend!', bg: '#f4511e', t: now - 5 * h },
      { type: 'image', art: { emoji: '🥐', bg: 'linear-gradient(135deg,#f6d365,#fda085)' }, caption: 'New arrival: Matcha croissant', t: now - 4 * h },
    ] },
    { contactId: 'c_priya', viewed: true, items: [
      { type: 'text', text: 'Goa, here we come! 🏖️', bg: '#0288d1', t: now - 8 * h },
    ] },
  ];

  const calls = [
    { id: 'k1', chatId: 'ch_siva', dir: 'out', video: false, t: now - 2 * h, dur: 312 },
    { id: 'k2', chatId: 'ch_mom', dir: 'in', video: true, t: now - d - 3 * h, missed: true },
    { id: 'k3', chatId: 'ch_trip', dir: 'out', video: true, t: now - 2 * d, dur: 1440 },
    { id: 'k4', chatId: 'ch_ramesh', dir: 'in', video: false, t: now - 3 * d, dur: 95 },
  ];

  return {
    version: 1,
    me: { id: 'me', name: 'Bushra', username: 'bushra', about: 'Hey there! I am using WHATSMORE.', color: '#1565d8' },
    contacts, directory, catalog, chats, communities, statuses, calls,
    myStatus: { items: [] },
    payments: [
      { id: 'pay1', dir: 'out', amount: 18500, with: 'Ramesh Kumar', note: 'INV-2041 · Website work', t: jan(16, 16, 40) },
    ],
    wallet: 25000,
    signature: null,
    mod: {},
    devices: [
      { id: 'd_phone', kind: 'phone', name: 'iPhone 15 · WHATSMORE iOS', where: 'Hyderabad, IN', t: now - 20 * m, primary: true },
      { id: 'd_web', kind: 'devices', name: 'This browser · WHATSMORE Web', where: 'Hyderabad, IN', t: now, current: true },
      { id: 'd_win', kind: 'laptop', name: 'Windows PC · WHATSMORE Desktop', where: 'Bengaluru, IN', t: now - 6 * d },
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
      emergency: { contacts: ['c_mom', 'c_siva'], message: 'I need help. This is an emergency. My current location is being shared with my emergency contacts.' },
      sessions: [
        { id: 's1', name: 'This browser', where: 'Hyderabad, IN', current: true, t: now },
        { id: 's2', name: 'iPhone 15 · WHATSMORE iOS', where: 'Hyderabad, IN', t: now - 20 * m },
        { id: 's3', name: 'Chrome on Windows', where: 'Bengaluru, IN', t: now - 6 * d },
      ],
    },
  };
};
