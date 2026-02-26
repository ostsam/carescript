function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceToken(text: string, token: string, replacement: string) {
  if (!token) return text;
  const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi");
  return text.replace(pattern, replacement);
}

export type SanitizationContext = {
  patientName?: string;
  patientAliases?: string[];
  nurseName?: string;
  lovedOneName?: string;
};

export function sanitizeForAgent(text: string, context: SanitizationContext): string {
  let sanitized = text;
  if (context.patientName) {
    sanitized = replaceToken(sanitized, context.patientName, "[Patient]");
  }
  if (context.patientAliases) {
    context.patientAliases.forEach((alias) => {
      sanitized = replaceToken(sanitized, alias, "[Patient]");
    });
  }
  if (context.nurseName) {
    sanitized = replaceToken(sanitized, context.nurseName, "[Nurse]");
  }
  if (context.lovedOneName) {
    sanitized = replaceToken(sanitized, context.lovedOneName, "[LovedOne]");
  }

  sanitized = sanitized
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[Email]")
    .replace(
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[Phone]",
    );

  return sanitized;
}

export function hydrateFromAgent(text: string, context: SanitizationContext): string {
  let hydrated = text;
  if (context.patientName) {
    hydrated = hydrated.replace(/\[patient\]/gi, context.patientName);
  }
  if (context.nurseName) {
    hydrated = hydrated.replace(/\[nurse\]/gi, context.nurseName);
  }
  if (context.lovedOneName) {
    hydrated = hydrated.replace(/\[lovedone\]/gi, context.lovedOneName);
  }
  return hydrated;
}
