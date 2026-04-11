import Phaser from 'phaser'
import Player from './Player'
import { phaserEvents, Event } from '../events/EventCenter'

export type NPCType = 'agent' | 'ghost'

export default class NPCCharacter extends Player {
  readonly npcType: NPCType
  readonly npcId: string
  private typingIndicator: Phaser.GameObjects.Container | null = null
  private typingDots: Phaser.GameObjects.Text[] = []
  private typingAnimTime = 0
  private glowFx: any = null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    name: string,
    npcType: NPCType,
    npcId: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, id, frame)

    this.npcType = npcType
    this.npcId = npcId

    // Set ghost NPCs semi-transparent
    if (npcType === 'ghost') {
      this.setAlpha(0.5)
    }

    // Update name label with [NPC] tag
    this.playerName.setText(`[NPC] ${name}`)
    this.playerName.setColor(npcType === 'agent' ? '#42eacb' : '#aaaaaa')

    // Apply glow outline via postFX if available (Phaser 3.60+)
    this.applyGlow()

    // Build typing indicator (hidden by default)
    this.buildTypingIndicator()
  }

  private applyGlow() {
    try {
      const color = this.npcType === 'agent' ? 0x42eacb : 0x888888
      // pipeline-based glow — gracefully skip if not supported
      if ((this as any).preFX) {
        this.glowFx = (this as any).preFX.addGlow(color, 4, 0, false, 0.1, 16)
      }
    } catch {
      // glow not supported in this Phaser build — silently skip
    }
  }

  private buildTypingIndicator() {
    this.typingIndicator = this.scene.add
      .container(this.x, this.y - 50)
      .setDepth(5001)
      .setVisible(false)

    const bg = this.scene.add
      .graphics()
      .fillStyle(0x000000, 0.6)
      .fillRoundedRect(-20, -10, 40, 20, 8)

    const dot1 = this.scene.add.text(-10, -6, '.', { fontSize: '18px', color: '#ffffff' })
    const dot2 = this.scene.add.text(0, -6, '.', { fontSize: '18px', color: '#ffffff' })
    const dot3 = this.scene.add.text(10, -6, '.', { fontSize: '18px', color: '#ffffff' })

    this.typingDots = [dot1, dot2, dot3]
    this.typingIndicator.add([bg, dot1, dot2, dot3])
  }

  setTyping(isTyping: boolean) {
    if (!this.typingIndicator) return
    this.typingIndicator.setVisible(isTyping)
    if (isTyping) {
      this.typingAnimTime = 0
    }
  }

  showInteractionPrompt(npcName: string) {
    // Re-uses existing dialog bubble for the proximity prompt
    this.updateDialogBubble(`Press R to talk to ${npcName}`)
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt)

    // Keep typing indicator above player
    if (this.typingIndicator && this.typingIndicator.visible) {
      this.typingIndicator.setPosition(this.x, this.y - 50)

      // Animate dots: cycle visibility every 400ms per dot
      this.typingAnimTime += dt
      const cycle = 400
      for (let i = 0; i < this.typingDots.length; i++) {
        const phase = (this.typingAnimTime + i * cycle) % (cycle * this.typingDots.length)
        this.typingDots[i].setAlpha(phase < cycle ? 1 : 0.2)
      }
    }
  }

  destroy(fromScene?: boolean) {
    this.typingIndicator?.destroy()
    this.playerContainer.destroy()
    super.destroy(fromScene)
  }
}

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      npcCharacter(
        x: number,
        y: number,
        texture: string,
        id: string,
        name: string,
        npcType: NPCType,
        npcId: string,
        frame?: string | number
      ): NPCCharacter
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
  'npcCharacter',
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    texture: string,
    id: string,
    name: string,
    npcType: NPCType,
    npcId: string,
    frame?: string | number
  ) {
    const sprite = new NPCCharacter(this.scene, x, y, texture, id, name, npcType, npcId, frame)

    this.displayList.add(sprite)
    this.updateList.add(sprite)

    this.scene.physics.world.enableBody(sprite, Phaser.Physics.Arcade.DYNAMIC_BODY)

    const collisionScale = [0.5, 0.2]
    sprite.body
      .setSize(sprite.width * collisionScale[0], sprite.height * collisionScale[1])
      .setOffset(
        sprite.width * (1 - collisionScale[0]) * 0.5,
        sprite.height * (1 - collisionScale[1]) * 0.5 + 17
      )

    return sprite
  }
)
