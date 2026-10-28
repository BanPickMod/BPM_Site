/**
 * Which stored replays are public (docs/BPM_Backend_Plan.md section 2). One condition, used by every public read, the statistics
 * and the report statement, so "public" cannot mean two things. See lib/server/publicReplays.ts for what each part guards.
 */
export const PUBLIC_WHERE = "status = 'READY' and c2_at_upload and visibility_override <> 'private' and hidden_at is null and timeline_key is not null";
