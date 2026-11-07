'use client';
// Extension points of the settings area (used by the live layer).

export interface ProfileInput { name: string; username: string; about: string }

/**
 * Run before Settings → Profile saves locally. A hook that returns true has handled the save
 * (e.g. the live layer writes the profile to the signed-in account) and the local save is skipped.
 */
export const profileSaveHooks: ((p: ProfileInput) => boolean | Promise<boolean>)[] = [];
