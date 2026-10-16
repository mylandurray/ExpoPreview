// Mutable scratch state for an in-progress viewport drag. Kept out of the
// store because it changes on every pointer move and nothing renders from it.
export const dragState = { offsetX: 0, offsetZ: 0, startX: 0, startY: 0, moved: false }
