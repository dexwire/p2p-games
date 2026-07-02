const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const restartBtn = document.getElementById('restartBtn');

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false,
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

function setKeyState(event, isPressed) {
  const key = event.key || '';
  const code = event.code || '';

  if (code === 'ArrowUp' || key.toLowerCase() === 'w') keys.ArrowUp = isPressed;
  if (code === 'ArrowDown' || key.toLowerCase() === 's') keys.ArrowDown = isPressed;
  if (code === 'ArrowLeft' || key.toLowerCase() === 'a') keys.ArrowLeft = isPressed;
  if (code === 'ArrowRight' || key.toLowerCase() === 'd') keys.ArrowRight = isPressed;

  if (key.toLowerCase() === 'w') keys.w = isPressed;
  if (key.toLowerCase() === 'a') keys.a = isPressed;
  if (key.toLowerCase() === 's') keys.s = isPressed;
  if (key.toLowerCase() === 'd') keys.d = isPressed;
}
const roomState = {
  room: 1,
  health: 1,
  playerSpeed: 220,
  dropCooldown: 3000,
  snailDuration: 2500,
  player: null,
  enemies: [],
  chests: [],
  exit: null,
  snails: [],
  walls: [],
  lastDropTime: 0,
  roomCleared: false,
  gameOver: false,
  message: '',
  messageUntil: 0,
  chestChosen: false,
};

function resetGame() {
  roomState.room = 1;
  roomState.health = 1;
  roomState.playerSpeed = 220;
  roomState.dropCooldown = 3000;
  roomState.snailDuration = 2500;
  roomState.enemies = [];
  roomState.chests = [];
  roomState.exit = null;
  roomState.snails = [];
  roomState.walls = [];
  roomState.lastDropTime = 0;
  roomState.roomCleared = false;
  roomState.gameOver = false;
  roomState.message = 'Room 1';
  roomState.messageUntil = performance.now() + 1200;
  roomState.chestChosen = false;
  roomState.player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 16,
    invulnerableUntil: 0,
  };
  startRoom();
}

function startRoom() {
  roomState.enemies = [];
  roomState.chests = [];
  roomState.exit = null;
  roomState.snails = [];
  roomState.walls = [];
  roomState.roomCleared = false;
  roomState.chestChosen = false;
  roomState.player.x = canvas.width / 2;
  roomState.player.y = canvas.height / 2;
  roomState.player.invulnerableUntil = 0;
  
  const enemyCount = roomState.room;
  for (let i = 0; i < enemyCount; i += 1) {
    roomState.enemies.push(createEnemy());
  }

  const chestTypes = ['heal', 'speed', 'cooldown'];
  const chosenChestType = chestTypes[Math.floor(Math.random() * chestTypes.length)];
  const chosenIndex = chestTypes.indexOf(chosenChestType);

  roomState.chests = [
    createChest(chosenChestType, 80, 80),
    createChest(chestTypes[(chosenIndex + 1) % 3], canvas.width - 80, 80),
  ];
  roomState.exit = {
    x: canvas.width - 80,
    y: canvas.height - 80,
    radius: 20,
  };

  roomState.message = `Room ${roomState.room}`;
  roomState.messageUntil = performance.now() + 1400;
}

function createEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -40;
  } else if (side === 1) {
    x = canvas.width + 40;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 40;
  } else {
    x = -40;
    y = Math.random() * canvas.height;
  }
  return {
    x,
    y,
    radius: 14,
    speed: 90 + roomState.room * 8,
    stunnedUntil: 0,
    wanderTimer: Math.random() * 2,
    wanderStrength: 1.2 + Math.random() * 1.8,
  };
}

function createChest(type, x, y, isActive = true) {
  return {
    type,
    x,
    y,
    radius: 16,
    active: isActive,
  };
}

function update(delta) {
  if (roomState.gameOver) {
    return;
  }

  const now = performance.now();
  const moveX = Number(keys.ArrowRight || keys.d) - Number(keys.ArrowLeft || keys.a);
  const moveY = Number(keys.ArrowDown || keys.s) - Number(keys.ArrowUp || keys.w);
  const length = Math.hypot(moveX, moveY) || 1;

  if (moveX || moveY) {
    roomState.player.x += (moveX / length) * roomState.playerSpeed * delta;
    roomState.player.y += (moveY / length) * roomState.playerSpeed * delta;
  }

  roomState.player.x = Math.max(20, Math.min(canvas.width - 20, roomState.player.x));
  roomState.player.y = Math.max(20, Math.min(canvas.height - 20, roomState.player.y));

  roomState.walls.forEach((wall) => {
    const overlapX = Math.abs(roomState.player.x - wall.x) < roomState.player.radius + wall.w / 2;
    const overlapY = Math.abs(roomState.player.y - wall.y) < roomState.player.radius + wall.h / 2;
    if (overlapX && overlapY) {
      if (Math.abs(roomState.player.x - wall.x) > Math.abs(roomState.player.y - wall.y)) {
        roomState.player.x = roomState.player.x > wall.x ? wall.x + wall.w / 2 + roomState.player.radius : wall.x - wall.w / 2 - roomState.player.radius;
      } else {
        roomState.player.y = roomState.player.y > wall.y ? wall.y + wall.h / 2 + roomState.player.radius : wall.y - wall.h / 2 - roomState.player.radius;
      }
    }
  });

  if (now - roomState.lastDropTime >= roomState.dropCooldown) {
    dropSnail();
    roomState.lastDropTime = now;
  }

  roomState.snails = roomState.snails.filter((snail) => now <= snail.expiresAt);

  roomState.snails.forEach((snail) => {
    if (roomState.enemies.length > 0) {
      const closestEnemy = roomState.enemies.reduce((closest, enemy) => {
        const distToEnemy = distance(snail, enemy);
        const distToClosest = distance(snail, closest);
        return distToEnemy < distToClosest ? enemy : closest;
      });
      const dx = closestEnemy.x - snail.x;
      const dy = closestEnemy.y - snail.y;
      const dist = Math.hypot(dx, dy) || 1;
      const enemySpeed = 90 + roomState.room * 8;
      const snailSpeed = (enemySpeed * enemySpeed) / roomState.playerSpeed;
      snail.x += (dx / dist) * snailSpeed * delta;
      snail.y += (dy / dist) * snailSpeed * delta;

      const enemyIndexToRemove = roomState.enemies.findIndex((enemy) => distance(snail, enemy) < 25);
      if (enemyIndexToRemove !== -1) {
        roomState.enemies.splice(enemyIndexToRemove, 1);
        snail.expiresAt = 0;
        roomState.message = 'Snail ate a mouse!';
        roomState.messageUntil = now + 900;
      }
    }
  });

  roomState.enemies.forEach((enemy) => {
    if (enemy.stunnedUntil > now) {
      return;
    }

    const dx = roomState.player.x - enemy.x;
    const dy = roomState.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const chaseX = (dx / dist) * enemy.speed * delta;
    const chaseY = (dy / dist) * enemy.speed * delta;

    enemy.wanderTimer -= delta;
    if (enemy.wanderTimer <= 0) {
      enemy.wanderTimer = 0.35 + Math.random() * 0.5;
      enemy.wanderStrength = 1.2 + Math.random() * 1.8;
    }

    const wanderX = Math.sin(now * 0.001 + enemy.x * 0.01) * enemy.wanderStrength * 18;
    const wanderY = Math.cos(now * 0.0015 + enemy.y * 0.01) * enemy.wanderStrength * 18;

    enemy.x += chaseX + wanderX * delta;
    enemy.y += chaseY + wanderY * delta;

    roomState.walls.forEach((wall) => {
      const overlapX = Math.abs(enemy.x - wall.x) < enemy.radius + wall.w / 2;
      const overlapY = Math.abs(enemy.y - wall.y) < enemy.radius + wall.h / 2;
      if (overlapX && overlapY) {
        if (Math.abs(enemy.x - wall.x) > Math.abs(enemy.y - wall.y)) {
          enemy.x = enemy.x > wall.x ? wall.x + wall.w / 2 + enemy.radius : wall.x - wall.w / 2 - enemy.radius;
        } else {
          enemy.y = enemy.y > wall.y ? wall.y + wall.h / 2 + enemy.radius : wall.y - wall.h / 2 - enemy.radius;
        }
      }
    });

    if (roomState.snail && distance(enemy, roomState.snail) < enemy.radius + roomState.snail.radius) {
      return;
    }

    if (distance(enemy, roomState.player) < enemy.radius + roomState.player.radius) {
      if (now > roomState.player.invulnerableUntil) {
        roomState.health -= 1;
        roomState.player.invulnerableUntil = now + 650;
        roomState.message = 'Ouch!';
        roomState.messageUntil = now + 900;
        if (roomState.health <= 0) {
          roomState.gameOver = true;
          roomState.message = 'Game Over';
          roomState.messageUntil = now + 10000;
        }
      }
    }


  });

  roomState.chests.forEach((chest) => {
    if (!chest.active) {
      return;
    }
    if (distance(roomState.player, chest) < roomState.player.radius + chest.radius) {
      applyChestEffect(chest.type);
      roomState.chests.forEach((otherChest) => {
        if (otherChest !== chest) {
          otherChest.active = false;
        }
      });
      chest.active = false;
      roomState.chestChosen = true;
      roomState.message = `Chest: ${chest.type}`;
      roomState.messageUntil = now + 1200;
    }
  });

  if (roomState.exit && distance(roomState.player, roomState.exit) < roomState.player.radius + roomState.exit.radius) {
    roomState.room += 1;
    startRoom();
  }
}

function applyChestEffect(type) {
  if (type === 'heal') {
    roomState.health += 1;
  } else if (type === 'speed') {
    roomState.playerSpeed += 35;
  } else if (type === 'cooldown') {
    roomState.dropCooldown = Math.max(500, roomState.dropCooldown - 450);
  }
}


function dropSnail() {
  roomState.snails.push({
    x: roomState.player.x,
    y: roomState.player.y,
    radius: 16,
    expiresAt: performance.now() + roomState.snailDuration,
  });
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  roomState.walls.forEach((wall) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wall.x - wall.w / 2 + 2, wall.y - wall.h / 2 + 2, wall.w - 4, wall.h - 4);
  });

  roomState.chests.forEach((chest) => {
    if (!chest.active) {
      return;
    }
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(chest.x - 14, chest.y - 14, 28, 28);
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chestIcons = { heal: '❤️', cooldown: '⏱️', speed: '⚡' };
    ctx.fillText(chestIcons[chest.type], chest.x, chest.y);
  });

  if (roomState.exit) {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(roomState.exit.x, roomState.exit.y, roomState.exit.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText('EXIT', roomState.exit.x, roomState.exit.y + 4);
  }

  roomState.snails.forEach((snail) => {
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐌', snail.x, snail.y);
  });

  roomState.enemies.forEach((enemy) => {
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.stunnedUntil > performance.now() ? '🐭' : '🐭', enemy.x, enemy.y);
  });

  ctx.font = '36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐱', roomState.player.x, roomState.player.y);

  if (roomState.message && performance.now() < roomState.messageUntil) {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(roomState.message, canvas.width / 2, 40);
  }
}

function updateUI() {
  statusEl.textContent = roomState.gameOver ? `Game Over • Room ${roomState.room}` : `Room ${roomState.room}`;
  statsEl.innerHTML = `Health: ${roomState.health} • Speed: ${Math.round(roomState.playerSpeed)} • Drop cooldown: ${Math.round(roomState.dropCooldown / 1000)}s`;
}

function loop(timestamp) {
  const delta = Math.min(0.032, (timestamp - (loop.lastTime || timestamp)) / 1000);
  loop.lastTime = timestamp;
  update(delta);
  draw();
  updateUI();
  requestAnimationFrame(loop);
}

canvas.tabIndex = 1000;
canvas.addEventListener('keydown', (event) => {
  setKeyState(event, true);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(event.key)) {
    event.preventDefault();
  }
});

canvas.addEventListener('keyup', (event) => {
  setKeyState(event, false);
});

canvas.addEventListener('mousedown', () => canvas.focus());
canvas.addEventListener('blur', () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});

restartBtn.addEventListener('click', resetGame);
window.addEventListener('keydown', (event) => {
  if ((event.key || '').toLowerCase() === 'r') {
    resetGame();
  }
});

resetGame();
requestAnimationFrame(loop);
