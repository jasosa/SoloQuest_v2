import type { Quest } from './schema';

/** The room the heroes start in, or undefined when they start outside an iron entry door. */
export const startArea = (q: Pick<Quest, 'start'>): string | undefined => q.start.area;

/**
 * The start room for places that always need a room (the editor, until it can place an entry
 * door): the start room, or R01 when the heroes start outside a door.
 */
export const startRoomOr = (q: Pick<Quest, 'start'>): string => q.start.area ?? 'R01';
