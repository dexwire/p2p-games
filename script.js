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
  trapDuration: 2000,
  stunDuration: 1000,
  player: null,
  enemies: [],
  chests: [],
  exit: null,
  trap: null,
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
  roomState.trapDuration = 2000;
  roomState.stunDuration = 1000;
  roomState.enemies = [];
  roomState.chests = [];
  roomState.exit = null;
  roomState.trap = null;
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
  roomState.trap = null;
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

  if (now - roomState.lastDropTime >= roomState.dropCooldown) {
    dropTrap();
    roomState.lastDropTime = now;
  }

  if (roomState.trap && now > roomState.trap.expiresAt) {
    roomState.trap = null;
  }

  roomState.enemies.forEach((enemy) => {
    if (enemy.stunnedUntil > now) {
      return;
    }

    const dx = roomState.player.x - enemy.x;
    const dy = roomState.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * delta;
    enemy.y += (dy / dist) * enemy.speed * delta;

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

    if (roomState.trap && roomState.trap.active && distance(enemy, roomState.trap) < enemy.radius + roomState.trap.radius) {
      enemy.stunnedUntil = now + roomState.stunDuration;
      roomState.trap.active = false;
      roomState.message = 'Enemy stunned!';
      roomState.messageUntil = now + 900;
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
    roomState.dropCooldown = Math.max(1000, roomState.dropCooldown - 300);
  }
}

function dropTrap() {
  roomState.trap = {
    x: roomState.player.x,
    y: roomState.player.y,
    radius: 18,
    active: true,
    expiresAt: performance.now() + roomState.trapDuration,
  };
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

  roomState.chests.forEach((chest) => {
    if (!chest.active) {
      return;
    }
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(chest.x - 14, chest.y - 14, 28, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chest.type.toUpperCase(), chest.x, chest.y + 4);
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

  if (roomState.trap && roomState.trap.active) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(roomState.trap.x, roomState.trap.y, roomState.trap.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  roomState.enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.stunnedUntil > performance.now() ? '#8b5cf6' : '#ef4444';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(roomState.player.x, roomState.player.y, roomState.player.radius, 0, Math.PI * 2);
  ctx.fill();

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
