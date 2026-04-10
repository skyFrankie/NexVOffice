import Network from '../services/Network'

export default class WebRTC {
  constructor(_userId: string, _network: Network) {}
  checkPreviousPermission() {}
  getUserMedia(_alertOnError = true) {}
  connectToNewUser(_userId: string) {}
  deleteVideoStream(_userId: string) {}
  deleteOnCalledVideoStream(_userId: string) {}
}
