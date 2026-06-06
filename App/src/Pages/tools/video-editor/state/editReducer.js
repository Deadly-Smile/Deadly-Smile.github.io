// Edit-session state shape and reducer.

export const initialEditState = {
  sourceFile:  null,
  meta:        null,
  trim:        null,
  audio:       { muted: false, volume: 1.0 },
  audioLayers: [],          // { id, file, startTime, endTime, volume, label }
  textLayers:  [],
  filters:     { brightness: 0, contrast: 1, saturation: 1, speed: 1 },
  activeFilter: null,
  filterRange: null,        // { start, end } — null = whole video
  snapshots:   [],          // { id, dataUrl, time }
};

export function editReducer(state, action) {
  switch (action.type) {
    case "SET_FILE":            return { ...initialEditState, sourceFile: action.file, meta: action.meta };
    case "SET_TRIM":            return { ...state, trim: action.trim };
    case "SET_AUDIO":           return { ...state, audio: { ...state.audio, ...action.audio } };
    case "ADD_AUDIO_LAYER":     return { ...state, audioLayers: [...state.audioLayers, action.layer] };
    case "REMOVE_AUDIO_LAYER":  return { ...state, audioLayers: state.audioLayers.filter((_, i) => i !== action.index) };
    case "UPDATE_AUDIO_LAYER":  return { ...state, audioLayers: state.audioLayers.map((l, i) => i === action.index ? { ...l, ...action.patch } : l) };
    case "ADD_TEXT_LAYER":      return { ...state, textLayers: [...state.textLayers, action.layer] };
    case "REMOVE_TEXT_LAYER":   return { ...state, textLayers: state.textLayers.filter((_, i) => i !== action.index) };
    case "SET_FILTER":          return { ...state, filters: { ...state.filters, ...action.filters } };
    case "SET_ACTIVE_FILTER":   return { ...state, activeFilter: action.name };
    case "SET_FILTER_RANGE":    return { ...state, filterRange: action.range };
    case "ADD_SNAPSHOT":        return { ...state, snapshots: [...state.snapshots, action.snap] };
    case "REMOVE_SNAPSHOT":     return { ...state, snapshots: state.snapshots.filter((_, i) => i !== action.index) };
    default: return state;
  }
}
