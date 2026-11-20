/**
 * Identifies this build of the site. It is evaluated once per build, so every page of one deploy
 * carries the same value, and a page from a later deploy carries a different one.
 */
export const BUILD_ID = Date.now().toString(36);
