/**
 * Emberveil's account + cloud-data client.
 *
 * Supabase was replaced by our own game server (rgs-api, see
 * ~/claude/rads-game-server/docs/API.md). The export names are kept so the
 * rest of the game did not need to change: `supabase` is now the small rgs
 * stand-in in ./rgs/client.js, which answers the same calls the same way.
 *
 * Server address: VITE_RGS_API at build time, otherwise '/api' on the same site.
 */
import { createRgsClient } from './rgs/client.js';

const API_BASE = (import.meta.env && import.meta.env.VITE_RGS_API) || '/api';

export const supabaseConfigured = true;

export const supabase = createRgsClient({ baseUrl: API_BASE, game: 'emberveil' });
