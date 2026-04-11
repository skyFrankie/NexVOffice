import Phaser from 'phaser'
import Network from '../services/Network'
import networkService from '../services/NetworkService'
import roomService from '../services/RoomService'
import { BackgroundMode } from '../../../types/BackgroundMode'
import store from '../stores'
import { setRoomJoined } from '../stores/RoomStore'

export default class Bootstrap extends Phaser.Scene {
  private preloadComplete = false
  private mapData: any = null
  network!: Network

  constructor() {
    super('bootstrap')
  }

  preload() {
    this.load.atlas(
      'cloud_day',
      'assets/background/cloud_day.png',
      'assets/background/cloud_day.json'
    )
    this.load.image('backdrop_day', 'assets/background/backdrop_day.png')
    this.load.atlas(
      'cloud_night',
      'assets/background/cloud_night.png',
      'assets/background/cloud_night.json'
    )
    this.load.image('backdrop_night', 'assets/background/backdrop_night.png')
    this.load.image('sun_moon', 'assets/background/sun_moon.png')

    // Load static tilemap as fallback — will be overwritten in launchGame() if API data arrives
    this.load.tilemapTiledJSON('tilemap', 'assets/map/map.json')

    this.load.spritesheet('tiles_wall', 'assets/map/FloorAndGround.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('chairs', 'assets/items/chair.png', {
      frameWidth: 32,
      frameHeight: 64,
    })
    this.load.spritesheet('computers', 'assets/items/computer.png', {
      frameWidth: 96,
      frameHeight: 64,
    })
    this.load.spritesheet('whiteboards', 'assets/items/whiteboard.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    this.load.spritesheet('vendingmachines', 'assets/items/vendingmachine.png', {
      frameWidth: 48,
      frameHeight: 72,
    })
    this.load.spritesheet('office', 'assets/tileset/Modern_Office_Black_Shadow.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('basement', 'assets/tileset/Basement.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('generic', 'assets/tileset/Generic.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('adam', 'assets/character/adam.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('ash', 'assets/character/ash.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('lucy', 'assets/character/lucy.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('nancy', 'assets/character/nancy.png', {
      frameWidth: 32,
      frameHeight: 48,
    })

    this.load.on('complete', () => {
      this.preloadComplete = true
      this.launchBackground(store.getState().user.backgroundMode)
    })
  }

  init() {
    this.network = new Network()
    networkService.setNetwork(this.network)

    // Subscribe to store changes for background mode side effects
    let prevBackgroundMode = store.getState().user.backgroundMode
    const unsubscribeStore = store.subscribe(() => {
      const backgroundMode = store.getState().user.backgroundMode
      if (backgroundMode !== prevBackgroundMode) {
        this.changeBackgroundMode(backgroundMode)
        prevBackgroundMode = backgroundMode
      }
    })
    this.events.once('shutdown', unsubscribeStore)
  }

  private launchBackground(backgroundMode: BackgroundMode) {
    this.scene.launch('background', { backgroundMode })
  }

  async launchGame() {
    if (!this.preloadComplete) return

    // Fetch map data from API (done here instead of init() because Phaser doesn't await async init)
    if (!this.mapData) {
      const token = store.getState().auth.token
      try {
        const res = await fetch('/api/map', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          this.mapData = await res.json()
        } else {
          console.error('Failed to fetch map:', res.status)
        }
      } catch (err) {
        console.error('Failed to fetch map:', err)
      }
    }

    // Overwrite static tilemap cache with API data if available
    if (this.mapData?.tilemap) {
      this.cache.tilemap.remove('tilemap')
      this.cache.tilemap.add('tilemap', {
        data: this.mapData.tilemap,
        format: Phaser.Tilemaps.Formats.TILED_JSON,
      })
    }

    this.network.webRTC?.checkPreviousPermission()
    this.scene.launch('game', {
      network: this.network,
      mapData: this.mapData,
    })

    // Initialize room service for voice auto-join on zone enter
    roomService.init(this.network.mySessionId)

    // update Redux state
    store.dispatch(setRoomJoined(true))
  }

  changeBackgroundMode(backgroundMode: BackgroundMode) {
    this.scene.stop('background')
    this.launchBackground(backgroundMode)
  }
}
