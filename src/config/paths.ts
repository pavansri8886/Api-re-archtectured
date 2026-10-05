/**
 * config/paths.ts
 * What it does: knows where the repository root and the projects folder are.
 * Why it is separate: it has no side effects, so unit tests can use it without any environment set.
 */
import * as path from 'path';

/** Repository root (this file is src/config/paths.ts). */
export const ROOT = path.resolve(__dirname, '../..');

/** Folder that holds every project: <ROOT>/projects */
export const PROJECTS_DIR = path.join(ROOT, 'projects');
