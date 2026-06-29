/* */
class InertiaGame {
  constructor (cfg={},ph_cfg={}) {
    this.cfg = {
      // tile_size: 24,
      width: 640,
      height: 640,
      background_image: './assets/background.jpg',
      background_color: '#000000',
      mine_image: './assets/zapper.jpg',
      floor_image: './assets/floor.png',
      // stop_image: './assets/mine.jpg',
      wall_image: './assets/wall.jpg',
      player_image: './assets/player.png',
      gem_image: './assets/blue.png',
      stop_image: './assets/stop.png',
      enable_restart: false,
      ...cfg
    }
    this.ph_cfg = {
      type: Phaser.AUTO,
      width: this.cfg.width,
      height: this.cfg.height,
      // backgroundColor: this.cfg.background_color,
      transparent: true,
      physics: {
          default: 'arcade',
          arcade: {
              gravity: { y: 0 },
              debug: this.cfg.debug
          }
      },
      disableContextMenu: true,
      callbacks: {
        preBoot: (game) => {
            game.scene.add('InertiaScene', InertiaScene, true, this.cfg);
        },
      },
      ...ph_cfg
    };
    this.engine = new Phaser.Game(this.ph_cfg);
  }
}

class InertiaScene extends Phaser.Scene {
    // constructor() { //cfg) {
    //     super('InertiaScene');
    //     this.cfg = {
    //       tile_size: 32,
    //       // ...cfg
    //     }
    // }

    init(cfg) {
      this.cfg = this.config = cfg
    }

    preload() {
        // let gfx = this.make.graphics();
        // const ts = this.cfg.tile_size

        this.load.setPath(this.config.image_path);
        if (this.config.background_image) {
          this.load.image('background', this.config.background_image);
        }

        this.load.image('wall', this.config.wall_image);
        this.load.image('bomb', this.config.mine_image);
        this.load.image('floor', this.config.floor_image);
        this.load.image('player', this.config.player_image);      
        this.load.image('diamond', this.config.gem_image);      
        this.load.image('stop', this.config.stop_image);      
    }

    create() {
      this.SLIDE_SPEED = 200; // Constant slide speed
      this.buttons = []

      // Map: 1=Wall, P=Player, D=Diamond, B=Bomb, S=Stop (Circle)
      const levelMap = this.cfg.map || [
        "WWWWWWWWWWWWWWWWWWWW","W000000000000000000W","W0000WS00S000WS0BS0W","W0B0WB00BB000W000S0W","W0B0SW000W000W00000W",
        "W00000W00W00W00W0W0W","W000000S000S0W00000W","W0W000000000000WBWDW","W00SW000000S00W0000W","W000W0000000B000B00W",
        "W0SWWBS00B0WW00D000W","W000W0B00W0W00W0000W","W000000W0000S0BS000W","W000BW0000PS00W0000W","W0W0W0000000W000S00W",
        "W00000S000B0W00W0D0W","W00B00W0000000WWW00W","W000W0S000S0000SW00W","W000000D000D0000000W","WWWWWWWWWWWWWWWWWWWW"
      ];
      this.rowCount = levelMap[0].length
      this.TILE_SIZE = this.cfg.width / this.rowCount
      this.diamondsCollected = 0;
      this.totalDiamonds = 0;
      this.isSliding = false; // State tracker
      this.disabledStops = new Set();

      // this.floors = this.physics.add.staticGroup();
      this.walls = this.physics.add.staticGroup();
      this.diamonds = this.physics.add.staticGroup();
      this.bombs = this.physics.add.staticGroup();
      this.stopTiles = this.physics.add.staticGroup(); // New group

      if (this.config.background_image) {
          this.background = this.add.image(0, 0, 'background')
            .setOrigin(0, 0)
            .setDisplaySize(this.sys.canvas.width, this.sys.canvas.height)//.setTint(0xFFFFFF);
      }
      if (this.config.background_color) { this.cameras.main.setBackgroundColor(this.config.background_color); }

      // Parse Map
      const cdiff = 32 - this.TILE_SIZE
      levelMap.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const type = row[x];
            const posX = x * this.TILE_SIZE + this.TILE_SIZE/2;
            const posY = y * this.TILE_SIZE + this.TILE_SIZE/2;

            let f = this.add.image(posX, posY, 'floor');
            f.setDisplaySize(this.TILE_SIZE, this.TILE_SIZE);
            f.setAlpha(0.4)

            if (type === 'W') {
                let s = this.walls.create(posX, posY, 'wall');
                s.setDisplaySize(this.TILE_SIZE, this.TILE_SIZE);
                s.setAlpha(0.7); s.setTint(0xFF0000); //s.setBlendMode(0)
                s.body.setSize(this.TILE_SIZE, this.TILE_SIZE).setOffset(this.TILE_SIZE/2+cdiff,this.TILE_SIZE/2+cdiff);
                // s.setAlpha(0.6)
            } else if (type === 'P') {
                this.player = this.physics.add.sprite(posX, posY, 'player');
                this.player.body.setSize(this.TILE_SIZE - 4, this.TILE_SIZE - 4);
                this.player.setDisplaySize(this.TILE_SIZE, this.TILE_SIZE);
                this.player.setCollideWorldBounds(true);
                this.player.setDepth(10); // Ensure player is on top
                // Parameters: xOffset, yOffset, decay, power, color, samples, intensity
                this.player.preFX.addShadow(-3, -3, 0.1, 1, '#000000', 10, 0.5);
                this.player.body.allowRotation = true
            } else if (type === 'D') {
                let s = this.diamonds.create(posX, posY, 'diamond');
                this.totalDiamonds++;
                s.setDisplaySize(this.TILE_SIZE, this.TILE_SIZE);
                s.body.setSize(this.TILE_SIZE, this.TILE_SIZE).setOffset(this.TILE_SIZE/2+cdiff,this.TILE_SIZE/2+cdiff);
                s.preFX.addShine(Phaser.Math.Between(10, 20) / 10, 1.5, 3, false);
                // 3. Tween the outerStrength to create a pulsing effect
                // s.setTint(0xFFFFFF)
                // s.setAlpha(0.5)
                this.tweens.add({
                    targets: s.preFX.addGlow(0xFFFFFF, 1, 0, false, 0.1, 10),
                    outerStrength: 3,   // Maximum glow intensity
                    innerStrength: 1,   // Maximum glow intensity
                    yoyo: true,         // Reverse the tween
                    repeat: -1,         // Loop indefinitely
                    duration: Phaser.Math.Between(75, 100),     // Duration of one pulse cycle
                    ease: 'Sine.easeInOut' // Smooth easing
                });
            } else if (type === 'B') {
                let s = this.bombs.create(posX, posY, 'bomb');
                s.setDisplaySize(this.TILE_SIZE - 7, this.TILE_SIZE - 7);
                s.body.setSize(this.TILE_SIZE, this.TILE_SIZE).setOffset(this.TILE_SIZE/2+cdiff,this.TILE_SIZE/2+cdiff);
;

                // 3. Tween the outerStrength to create a pulsing effect
                this.tweens.add({
                    targets: s.preFX.addGlow(0xffdd33, 4, 4, false, 0.1, 10),
                    outerStrength: 8,   // Maximum glow intensity
                    innerStrength: 0,   // Maximum glow intensity
                    yoyo: true,         // Reverse the tween
                    repeat: -1,         // Loop indefinitely
                    duration: Phaser.Math.Between(650, 750),     // Duration of one pulse cycle
                    ease: 'Sine.easeInOut' // Smooth easing
                });
            } else if (type === 'S') {
                let s = this.stopTiles.create(posX, posY, 'stop');
                // s.setTint(0xFFFFFF); s.setBlendMode(3)
                s.setDisplaySize(this.TILE_SIZE, this.TILE_SIZE);
                s.body.setSize(this.TILE_SIZE/2, this.TILE_SIZE/2).setOffset(this.TILE_SIZE/1.3+cdiff,this.TILE_SIZE/1.3+cdiff);
            }
        }
      });

      if (this.cfg.enable_restart) {
        this.addButton(
          this.TILE_SIZE, 
          this.cfg.height - 36, 8, 'restart', 'RESTART',
          () => this.resetBoard()
        );
      }

      // Process callback: Only allow overlap if player is moving toward the object
      const isMovingToward = (player, obj) => {
        // --- MANUAL COLLISION CHECK ---
        // const speed = this.SLIDE_SPEED;
        const velX = this.player.body.velocity.x;
        const velY = this.player.body.velocity.y;
        
        // Determine direction (0, 1, or -1)
        const dirX = velX !== 0 ? Math.sign(velX) : 0;
        const dirY = velY !== 0 ? Math.sign(velY) : 0;

        // Calculate the coordinate of the NEXT tile center in the movement direction
        // We add a small buffer (e.g., 10 pixels) to check slightly ahead of the player's center
        const checkX = this.player.x + (dirX * (this.TILE_SIZE / 2 + 5));
        const checkY = this.player.y + (dirY * (this.TILE_SIZE / 2 + 5));
        const distance = Phaser.Math.Distance.Between(checkX, checkY, obj.x, obj.y)
        if (distance > (this.TILE_SIZE/2 - 2)) {
            return false
        }
        return true
      };

      // Colliders
      this.physics.add.collider(this.player, this.walls, this.handleWall, isMovingToward, this);
      this.physics.add.collider(this.player, this.bombs, this.handleBomb, isMovingToward, this);
      this.physics.add.overlap(this.player, this.stopTiles, this.handleStop, isMovingToward, this);
      this.physics.add.overlap(this.player, this.diamonds, this.collectDiamond, isMovingToward, this);

      // Input: Trigger slide on KEY DOWN only
      this.cursors = this.input.keyboard.createCursorKeys();
      
      const startSlide = (vx, vy) => {
          if (this.isSliding || !this.player.active) return;
          this.isSliding = true;
          this.player.setVelocity(vx, vy);
      };

      // --- CARDINAL KEYS (W, A, S, D) ---
      this.input.keyboard.on('keydown-W', () => startSlide(0, -this.SLIDE_SPEED));
      this.input.keyboard.on('keydown-S', () => startSlide(0, this.SLIDE_SPEED));
      this.input.keyboard.on('keydown-A', () => startSlide(-this.SLIDE_SPEED, 0));
      this.input.keyboard.on('keydown-D', () => startSlide(this.SLIDE_SPEED, 0));

      // Keyboard: Q, E, Z, C
      this.input.keyboard.on('keydown-Q', () => startSlide(-this.SLIDE_SPEED, -this.SLIDE_SPEED)); // Up-Left
      this.input.keyboard.on('keydown-E', () => startSlide(this.SLIDE_SPEED, -this.SLIDE_SPEED));  // Up-Right
      this.input.keyboard.on('keydown-Z', () => startSlide(-this.SLIDE_SPEED, this.SLIDE_SPEED));  // Down-Left
      this.input.keyboard.on('keydown-C', () => startSlide(this.SLIDE_SPEED, this.SLIDE_SPEED));   // Down-Right

      // Mouse Click: Calculate direction
      this.input.on('pointerdown', (pointer) => {
          if (this.isSliding || !this.player.active) return;

          const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);
          const deg = Phaser.Math.RadToDeg(angle);
          
          // Find matching sector
          // Handle wrap around for left
          let finalVx = 0, finalVy = 0;
          
          // Simple logic: normalize angle to 0-360
          let normAngle = deg;
          if (normAngle < 0) normAngle += 360;
          if (normAngle >= 337.5 || normAngle < 22.5) { finalVx = this.SLIDE_SPEED; finalVy = 0; } // Right
          else if (normAngle >= 22.5 && normAngle < 67.5) { finalVx = this.SLIDE_SPEED; finalVy = this.SLIDE_SPEED; } // SE
          else if (normAngle >= 67.5 && normAngle < 112.5) { finalVx = 0; finalVy = this.SLIDE_SPEED; } // Down
          else if (normAngle >= 112.5 && normAngle < 157.5) { finalVx = -this.SLIDE_SPEED; finalVy = this.SLIDE_SPEED; } // SW
          else if (normAngle >= 157.5 && normAngle < 202.5) { finalVx = -this.SLIDE_SPEED; finalVy = 0; } // Left
          else if (normAngle >= 202.5 && normAngle < 247.5) { finalVx = -this.SLIDE_SPEED; finalVy = -this.SLIDE_SPEED; } // NW
          else if (normAngle >= 247.5 && normAngle < 292.5) { finalVx = 0; finalVy = -this.SLIDE_SPEED; } // Up
          else if (normAngle >= 292.5 && normAngle < 337.5) { finalVx = this.SLIDE_SPEED; finalVy = -this.SLIDE_SPEED; } // NE

          startSlide(finalVx, finalVy);
      });

    }

  resetBoard() {
    // this.winText.setVisible(false);
    // for (let y = 0; y < this.config.grid_size; y++) {
    //   for (let x = 0; x < this.config.grid_size; x++) {
    //     this.grid[y][x] = this.source_grid[y][x]; 
    //     this.updateTile(x,y)
    //   }
    // }
    // this.enableLights()
    // this.winnable = true
    // this.config.on_start_audio()
  }

  addText(x,y,pad,name,text) {
    if (!this.texts) { this.texts = [] }
    this.texts[name] = this.add.text(
      x, 
      y, 
      text, {
        fontSize: '18px',
        fontStyle: 'bold',
        fill: '#FFFFFF',
        backgroundColor: '#000000',
        //stroke: '#ddaa00',
        //strokeThickness: 2,
        padding: { x: pad, y: pad/2 }
      }
    ).setOrigin(0.5,0.5).setAlpha(0.95);
    this.texts[name].preFX.addGlow(0XFFFFFF, 8, 0, false);
    return this.texts[name]
  }

  addButton(x,y,pad,name,text,ondown=function(){}) {
    // this.add.roundRectangle(0, 0, 300, 150, 20, 0x222222);
    this.buttons[name] = this.add.text(
      x, 
      y, 
      text, {
        fontSize: '18px',
        fontStyle: 'bold',
        fill: '#ffaa00',
        backgroundColor: '#000000',
        //stroke: '#ddaa00',
        //strokeThickness: 2,
        padding: { x: pad, y: pad/2 }
      }
    ).setOrigin(0,0).setInteractive().setAlpha(0.95);
    this.buttons[name].preFX.addGlow(0Xffaa00, 8, 0, false);
    this.buttons[name].on('pointerdown', ondown);
    return this.buttons[name]
  }

    updateRotation(dt,instant=false) {
      const dir = dt.body.velocity;
      if (!dt.last_dir) { dt.last_dir = dir.angle() }

      if (instant) { 
        let targetRot = Phaser.Math.Angle.Wrap(dir.angle());
        if (targetRot == 0) {
          targetRot = Phaser.Math.Angle.Wrap(dt.last_dir);
        }
        dt.rotation = targetRot; return 
      }
      if (dir.x == 0 && dir.y == 0) { return false; }
      const targetRot = Phaser.Math.Angle.Wrap(dir.angle());

      // Smoothly interpolate current rotation to target
      // Adjust 'step' (e.g., 0.1) to control rotation speed
      if (dir.length() > 0.05) {
        dt.rotation = Phaser.Math.Linear(dt.rotation, targetRot, 0.1);
      }
      dt.last_dir = dir.angle();

    }
    update() {
      // We simply check if the player has effectively stopped (velocity near 0)
      this.updateRotation(this.player)

      this.stopTiles.children.iterate((tile) => {
        if (!tile.body.enable) {
            // Simple distance check or overlap check to re-enable
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, tile.x, tile.y) > 20) {
              tile.body.enable = true;
            }
        }
      });
      if (this.isSliding && (this.player.body.velocity.length() < 10)) {
        // If velocity drops significantly (due to collision logic below), 
        // we reset the sliding state.
        // Note: The actual hard stop happens in handleStop, 
        // but this catches edge cases.
        this.isSliding = false;
        this.updateRotation(this.player,true)
        this.player.setVelocity(0);
      }

      if (!this.isSliding || !this.player.active) return;
    }

    handleWall(player, wall) {
        // 1. Stop Movement Immediately
        this.updateRotation(this.player,true)
        player.setVelocity(0);
        this.isSliding = false;

        // 2. Snap to Grid Center
        // Calculate which tile we are in
        const tileX = Math.round(player.x / this.TILE_SIZE) * this.TILE_SIZE;
        const tileY = Math.round(player.y / this.TILE_SIZE) * this.TILE_SIZE;
        
        // Center of that tile
        const centerX = tileX - (this.TILE_SIZE / 2) + (this.TILE_SIZE / 2); 
        // Actually simpler:
        const snapX = Math.floor(player.x / this.TILE_SIZE) * this.TILE_SIZE + this.TILE_SIZE/2;
        const snapY = Math.floor(player.y / this.TILE_SIZE) * this.TILE_SIZE + this.TILE_SIZE/2;

        // Apply snap
        player.setX(snapX);
        player.setY(snapY);
        
        // Reset physics body to prevent sticking/jitter
        player.body.reset(snapX, snapY);

        // Visual feedback
        player.setTint(0xffffff);
        player.setBlendMode(1);
        this.time.delayedCall(100, () => { if(player.active) player.clearTint(); player.setBlendMode(0); });
    }

    handleStop(player, tile) {
        if (!this.isSliding) return; // Only stop if we were moving

        // Disable this specific tile's physics so it doesn't fire again immediately
        tile.body.enable = false;//disable(); 

        // Stop and Snap
        this.updateRotation(this.player,true)        
        player.setVelocity(0);
        this.isSliding = false;
        
        const snapX = tile.x;
        const snapY = tile.y;
        player.setX(snapX);
        player.setY(snapY);
        player.body.reset(snapX, snapY);
        
        player.setTint(0xffaa00);
        this.time.delayedCall(100, () => { if(player.active) player.clearTint(); });
    }

    collectDiamond(player, diamond) {
        diamond.disableBody(true, true);
        this.diamondsCollected++;
        // this.statusText.style.color = "#000000";
        // this.statusText.innerText = `Diamonds: ${this.diamondsCollected}/${this.totalDiamonds}`;

        if (this.diamondsCollected === this.totalDiamonds) {
            // this.statusText.innerText = "YOU WIN!";
            // this.statusText.style.color = "#00ff00";
            this.physics.pause();
            this.doWin()
            player.setTint(0x00ff00);
        }
    }

    doWin() {
      this.winText = this.addText(
        this.cfg.width/2, 
        this.cfg.height/2, 8,
        'win', 'Completed!'
      )
      this.background.preFX.addShine(-1,1.5,3)
      this.background.preFX.addShine(1,1.7,3)
      this.background.preFX.addShine(2.1,1,3)
      this.stopTiles.setVisible(false)
      this.diamonds.setVisible(false)
      this.bombs.setVisible(false)
      this.player.setVisible(false)
      this.walls.setVisible(false)
      this.submit = `${this.cfg.seed}_${this.diamondsCollected}_${this.rowCount}`
      if (this.cfg.win_callback) {
        this.cfg.win_callback(this);
      }
    }

    handleBomb(player, bomb) {
        this.physics.pause();
        this.isSliding = false;
        player.setVelocity(0);
        player.setTint(0xff0000);
        // this.statusText.innerText = "GAME OVER!";
        // this.statusText.style.color = "#ff0000";
        // this.statusText.innerText = "GAME OVER! Hit a bomb.";
        // this.statusText.style.color = "#ff0000";
        
        // Simple explosion effect
        player.setTint(0xFF0000)
        this.explode(player)        
        this.explode(bomb)
        this.time.delayedCall(2000, () => { this.scene.stop(); this.scene.start(); });
    }

    explode(object) {
        object.setTint(0xff0000);
        const particles = this.add.particles(object.x, object.y, object.texture.key, {
            speed: 100,
            scale: { start: 0.5, end: 0 },
            rotate: { start: 0, end: 720 },
            blendMode: 'ADD',
            lifespan: 1200,
        }).setDepth(11);      
    }
}
