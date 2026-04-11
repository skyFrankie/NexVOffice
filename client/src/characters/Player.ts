import Phaser from 'phaser'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
/**
 * shifting distance for sitting animation
 * format: direction: [xShift, yShift, depthShift]
 */
export const sittingShiftData = {
  up: [0, 3, -10],
  down: [0, 3, 1],
  left: [0, -8, 10],
  right: [0, -8, 10],
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  playerId: string
  playerTexture: string
  playerBehavior = PlayerBehavior.IDLE
  readyToConnect = false
  videoConnected = false
  playerName: Phaser.GameObjects.Text
  playerContainer: Phaser.GameObjects.Container
  private playerDialogBubble: Phaser.GameObjects.Container
  private timeoutID?: number
  private hpBarGraphics?: Phaser.GameObjects.Graphics
  private hp = 100
  private maxHp = 100

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, frame)

    this.playerId = id
    this.playerTexture = texture
    this.setDepth(this.y)

    this.anims.play(`${this.playerTexture}_idle_down`, true)

    this.playerContainer = this.scene.add.container(this.x, this.y - 30).setDepth(5000)

    // add dialogBubble to playerContainer
    this.playerDialogBubble = this.scene.add.container(0, 0).setDepth(5000)
    this.playerContainer.add(this.playerDialogBubble)

    // add playerName to playerContainer
    this.playerName = this.scene.add
      .text(0, 0, '')
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#000000')
      .setOrigin(0.5)
    this.playerContainer.add(this.playerName)

    // HP bar above player name — hidden by default (full HP)
    this.hpBarGraphics = this.scene.add.graphics()
    this.hpBarGraphics.setDepth(5001)
    this.hpBarGraphics.setVisible(false)

    this.scene.physics.world.enable(this.playerContainer)
    const playContainerBody = this.playerContainer.body as Phaser.Physics.Arcade.Body
    const collisionScale = [0.5, 0.2]
    playContainerBody
      .setSize(this.width * collisionScale[0], this.height * collisionScale[1])
      .setOffset(-8, this.height * (1 - collisionScale[1]) + 6)
  }

  updateHp(hp: number, maxHp: number) {
    this.hp = hp
    this.maxHp = maxHp
    this.redrawHpBar()
  }

  private redrawHpBar() {
    if (!this.hpBarGraphics) return

    const isFull = this.hp >= this.maxHp
    if (isFull) {
      this.hpBarGraphics.setVisible(false)
      return
    }

    this.hpBarGraphics.setVisible(true)
    this.hpBarGraphics.clear()

    const barW = 40
    const barH = 4
    // position: above player, offset from container position
    const bx = this.x - barW / 2
    const by = this.y - this.height * 0.5 - 14

    // background track
    this.hpBarGraphics.fillStyle(0x333333, 0.8)
    this.hpBarGraphics.fillRect(bx, by, barW, barH)

    // fill
    const percent = this.maxHp > 0 ? this.hp / this.maxHp : 0
    const fillW = Math.max(0, barW * percent)
    const color = percent > 0.6 ? 0x22c55e : percent > 0.3 ? 0xeab308 : 0xef4444
    this.hpBarGraphics.fillStyle(color, 1)
    this.hpBarGraphics.fillRect(bx, by, fillW, barH)
  }

  updateDialogBubble(content: string) {
    this.clearDialogBubble()

    // preprocessing for dialog bubble text (maximum 70 characters)
    const dialogBubbleText = content.length <= 70 ? content : content.substring(0, 70).concat('...')

    const innerText = this.scene.add
      .text(0, 0, dialogBubbleText, { wordWrap: { width: 165, useAdvancedWrap: true } })
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#000000')
      .setOrigin(0.5)

    // set dialogBox slightly larger than the text in it
    const innerTextHeight = innerText.height
    const innerTextWidth = innerText.width

    innerText.setY(-innerTextHeight / 2 - this.playerName.height / 2)
    const dialogBoxWidth = innerTextWidth + 10
    const dialogBoxHeight = innerTextHeight + 3
    const dialogBoxX = innerText.x - innerTextWidth / 2 - 5
    const dialogBoxY = innerText.y - innerTextHeight / 2 - 2

    this.playerDialogBubble.add(
      this.scene.add
        .graphics()
        .fillStyle(0xffffff, 1)
        .fillRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
        .lineStyle(1, 0x000000, 1)
        .strokeRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
    )
    this.playerDialogBubble.add(innerText)

    // After 6 seconds, clear the dialog bubble
    this.timeoutID = window.setTimeout(() => {
      this.clearDialogBubble()
    }, 6000)
  }

  clearDialogBubble() {
    clearTimeout(this.timeoutID)
    this.playerDialogBubble.removeAll(true)
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt)
    // Keep HP bar positioned above the player sprite as it moves
    if (this.hpBarGraphics && this.hpBarGraphics.visible) {
      this.redrawHpBar()
    }
  }
}
