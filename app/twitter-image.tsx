import OG, { alt as ogAlt, size as ogSize, contentType as ogType } from "./opengraph-image";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogType;
// Segment config must be a literal in each route file (not re-exported); keep in
// sync with ./opengraph-image.
export const revalidate = 86400;
export default OG;
