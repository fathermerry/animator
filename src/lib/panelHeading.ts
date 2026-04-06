/** Label typography only (no margin) — use inside a row that supplies spacing, or with {@link panelHeadingClass}. */
export const panelHeadingLabelClass =
  "text-xs font-medium uppercase text-muted-foreground";

/** Uppercase workflow panel label — top margin clears the column / header rail. */
export const panelHeadingClass = `mt-4 ${panelHeadingLabelClass}`;

/** Same label styles after another block in the same column (e.g. Scenes below preview). */
export const panelHeadingAfterBlockClass =
  "mt-6 text-xs font-medium uppercase text-muted-foreground";
