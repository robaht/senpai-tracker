/**
 * A comfort pick — a show the user deliberately keeps in their Comfort Corner.
 *
 * Independent of watch status and of whether the title is tracked: we snapshot
 * the bit of display data we need (title, cover) at add-time, the same way
 * tracking does, so the shelf renders instantly/offline and a pick survives even
 * if the title is never added to (or is removed from) the watch list.
 */
export interface ComfortPick {
  mediaId: number;
  title: string;
  coverImage: string | null;
  coverColor: string | null;
  /** epoch ms — newest picks sort to the front of the shelf. */
  addedAt: number;
}
