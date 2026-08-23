export type TargetType = "publication" | "comment";

/** A row of the public.report_queue view. */
export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: TargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  target_author_id: string | null;
  target_text: string | null;
  target_hidden_at: string | null;
  target_created_at: string | null;
  photo_urls: string[] | null;
  mux_playback_id: string | null;
  city_id: string | null;
};

/** All reports filed against one piece of content. */
export type ReportGroup = {
  targetType: TargetType;
  targetId: string;
  targetText: string | null;
  targetAuthorId: string | null;
  targetHiddenAt: string | null;
  targetCreatedAt: string | null;
  photoUrls: string[] | null;
  muxPlaybackId: string | null;
  reports: ReportRow[];
};
