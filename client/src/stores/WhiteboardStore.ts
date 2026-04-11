import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface WhiteboardState {
  whiteboardDialogOpen: boolean
  whiteboardId: null | string
  urls: Map<string, string>
}

const initialState: WhiteboardState = {
  whiteboardDialogOpen: false,
  whiteboardId: null,
  urls: new Map(),
}

export const whiteboardSlice = createSlice({
  name: 'whiteboard',
  initialState,
  reducers: {
    openWhiteboardDialog: (state, action: PayloadAction<string>) => {
      state.whiteboardDialogOpen = true
      state.whiteboardId = action.payload
    },
    closeWhiteboardDialog: (state) => {
      state.whiteboardDialogOpen = false
      state.whiteboardId = null
    },
    setWhiteboardUrls: (state, action: PayloadAction<{ whiteboardId: string; roomId: string }>) => {
      state.urls.set(action.payload.whiteboardId, action.payload.roomId)
    },
  },
})

export const { openWhiteboardDialog, closeWhiteboardDialog, setWhiteboardUrls } =
  whiteboardSlice.actions

export default whiteboardSlice.reducer
