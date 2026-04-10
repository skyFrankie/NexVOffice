export default class ShareScreenManager {
  myStream?: MediaStream
  constructor(_userId: string) {}
  onOpen() {}
  onClose() {}
  startScreenShare() {}
  stopScreenShare(_shouldDispatch = true) {}
  onUserJoined(_userId: string) {}
  onUserLeft(_userId: string) {}
}
