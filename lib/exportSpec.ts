/**
 * What "download my data" contains, column by column (docs/Privacy_Compliance_Additional_Plan.md, A10). The export is built from
 * these lists, and `npm run test:privacy` compares them with docs/Privacy_Data_Inventory.md: every column about a person in the
 * tables a user owns must be either exported or named in NOT_EXPORTED with the reason. So "everything we hold about you" stays true
 * when a column is added, and what is left out is stated to the user (the export lists it under `notIncluded`).
 */
export const EXPORT_COLUMNS: Record<string, string[]> = {
  app_user: ["id", "provider", "subject", "display_name", "created_at", "age_confirmed_at", "onboarding_completed_at", "onboarding_policy_version", "policy_seen_version", "last_active_at", "inactive_notice_at"],
  consent: ["c1", "c2", "c3", "policy_version", "consent_version", "reconsent_pending", "updated_at"],
  consent_log: ["c1", "c2", "c3", "policy_version", "consent_version", "source", "at"],
  policy_ack: ["from_version", "to_version", "kind", "at"],
  device_token: ["id", "label", "created_at", "last_used_at", "revoked_at"],
  user_replay: [
    "id", "status", "reject_code", "size", "uploaded_at", "analyzed_at", "client_version", "c2_at_upload", "c3_at_upload",
    "visibility_override", "training_excluded", "source_deleted_at", "hidden_at", "analysis", "evaluation",
  ],
  feedback: ["id", "kind", "reason", "title", "body", "page", "user_agent", "status", "channel", "contact", "created_at", "resolved_at"],
};

/** Columns about a person that are not in the export, and why. Shown to the user in the export itself. */
export const NOT_EXPORTED: Record<string, string> = {
  "user_replay.sha256": "internal fingerprint of the uploaded file, used only to skip a second upload of the same file",
  "feedback.admin_note": "the operator's own working note on a message; ask the operator by email if you want it",
  "device_auth.last_poll": "short-lived device-link request record, deleted within days; not part of the account",
  "device_auth.created_at": "short-lived device-link request record, deleted within days; not part of the account",
};

/** Things that are held but are not columns, so the export points to them or says why they are missing. */
export const NOT_INCLUDED_OBJECTS: { item: string; reason: string }[] = [
  { item: "original replay files", reason: "deleted from the server once analysis and evaluation finish (at most 7 days); the analysis and playback record are included or linked" },
  { item: "playback timeline of each replay", reason: "large; download it per replay at /api/me/uploads/<id>/timeline" },
  { item: "screenshots you attached to messages", reason: "stored as files; ask the operator by email to receive them" },
  { item: "hourly rate-limit counters", reason: "keyed by an hourly hash that cannot be tied back to you, and deleted within two hours" },
];

/** "display_name" -> "displayName" for the JSON the user reads. */
export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Tables whose rows belong to one account; the inventory check covers their personal columns. */
export const USER_TABLES = ["app_user", "consent", "consent_log", "policy_ack", "device_auth", "device_token", "user_replay", "feedback", "feedback_file"];
