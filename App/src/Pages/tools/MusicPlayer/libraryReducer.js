export const initialLibraryState = {
  tracks: [],
  albums: [],
  playlists: [],
  loading: true,
  error: null,
};

export function libraryReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        tracks: action.tracks,
        albums: action.albums,
        playlists: action.playlists,
        loading: false,
      };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };

    case "ADD_TRACK":
      return { ...state, tracks: [...state.tracks, action.track] };
    case "UPDATE_TRACK":
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.id === action.track.id ? action.track : t)),
      };
    case "DELETE_TRACK":
      return { ...state, tracks: state.tracks.filter((t) => t.id !== action.id) };

    case "ADD_ALBUM":
      return { ...state, albums: [...state.albums, action.album] };
    case "UPDATE_ALBUM":
      return {
        ...state,
        albums: state.albums.map((a) => (a.id === action.album.id ? action.album : a)),
      };
    case "DELETE_ALBUM":
      return { ...state, albums: state.albums.filter((a) => a.id !== action.id) };

    case "ADD_PLAYLIST":
      return { ...state, playlists: [...state.playlists, action.playlist] };
    case "UPDATE_PLAYLIST":
      return {
        ...state,
        playlists: state.playlists.map((p) => (p.id === action.playlist.id ? action.playlist : p)),
      };
    case "DELETE_PLAYLIST":
      return { ...state, playlists: state.playlists.filter((p) => p.id !== action.id) };

    default:
      return state;
  }
}
