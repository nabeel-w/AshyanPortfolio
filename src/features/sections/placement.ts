/**
 * Sections get their `position` on the page from SectionRenderer. The first two (0–1) are above the
 * fold on phones, so they must not hide behind a reveal and their main image is the LCP candidate.
 */
export const isAboveFold = (position?: number) => position !== undefined && position <= 1;
