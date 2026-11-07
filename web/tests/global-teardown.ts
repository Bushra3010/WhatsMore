import { destroyFixture } from './accounts';
// Deletes the throwaway accounts and everything they created (chats, files, reports).
export default async function globalTeardown() { await destroyFixture(); }
