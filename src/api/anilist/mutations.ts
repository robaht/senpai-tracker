import { gql } from 'graphql-request';

/**
 * Authenticated list mutations (F1 sync). Require an OAuth bearer token on the
 * client (see `setAuthToken`). `SaveMediaListEntry` upserts by `mediaId` and
 * returns the `MediaList` entry `id`; `DeleteMediaListEntry` removes by that id.
 *
 * `score` is a Float in the *viewer's* configured score format, so callers must
 * convert from our internal POINT_10 before sending (see sync).
 */
export const SAVE_MEDIA_LIST_ENTRY = gql`
  mutation Save($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
      id
      mediaId
    }
  }
`;

export const DELETE_MEDIA_LIST_ENTRY = gql`
  mutation Delete($id: Int) {
    DeleteMediaListEntry(id: $id) {
      deleted
    }
  }
`;
