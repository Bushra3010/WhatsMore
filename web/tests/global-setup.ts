import { createFixture } from './accounts';
// Creates the two throwaway accounts (and their chat, story and file) used by the suite.
export default async function globalSetup() { await createFixture(); }
