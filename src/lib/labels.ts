// French labels for the enum values stored in the database.

export const REPORT_REASON: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Contenu inapproprié",
  harassment: "Harcèlement",
  false_info: "Fausse information",
  other: "Autre",
};

export const REPORT_STATUS: Record<string, string> = {
  pending: "En attente",
  reviewed: "Examiné",
  actioned: "Traité",
  dismissed: "Rejeté",
};

export const PUBLICATION_TYPE: Record<string, string> = {
  anomaly: "Anomalie",
  initiative: "Initiative",
  info: "Info",
};

export const TARGET_TYPE: Record<string, string> = {
  publication: "Publication",
  comment: "Commentaire",
};
