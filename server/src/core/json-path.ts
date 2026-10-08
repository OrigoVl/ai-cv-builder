// Minimal path get/set for the dot+bracket paths used throughout the LLM pipeline
// (e.g. "experience[1].bullets[0]", "contact.email", "skills[3]"). Deliberately tiny — no need
// for a dependency like lodash.get for the handful of shapes the CV schema actually has.
export type PathSegment = { key: string } | { index: number };

export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    if (m[1] !== undefined) segments.push({ key: m[1] });
    else if (m[2] !== undefined) segments.push({ index: Number(m[2]) });
  }
  return segments;
}

function segmentKey(seg: PathSegment): string | number {
  return "key" in seg ? seg.key : seg.index;
}

export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of parsePath(path)) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[segmentKey(seg)];
  }
  return cur;
}

/** Mutates `obj` in place, creating intermediate objects/arrays as needed. An out-of-range array
 * index is clamped to an append, since a path produced by the model could point one past the
 * end if it miscounted — safer than throwing or silently creating a sparse array. */
export function setByPath(obj: unknown, path: string, value: unknown): void {
  const segments = parsePath(path);
  if (segments.length === 0) return;
  let cur = obj as Record<string | number, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const key = segmentKey(seg);
    if (cur[key] == null) {
      const nextSeg = segments[i + 1]!;
      cur[key] = "index" in nextSeg ? [] : {};
    }
    cur = cur[key] as Record<string | number, unknown>;
  }
  const last = segments[segments.length - 1]!;
  if ("index" in last && Array.isArray(cur)) {
    if (last.index >= cur.length) cur.push(value);
    else cur[last.index] = value;
  } else {
    cur[segmentKey(last)] = value;
  }
}
