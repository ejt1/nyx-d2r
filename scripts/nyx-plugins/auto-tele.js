'use strict';

/**
 * Auto Teleport Plugin
 * 
 * Provides teleport functionality for Sorceress (or Enigma users).
 * 
 * Features:
 * - Teleport to cursor position on hotkey
 * - Auto-tele chain to a waypoint or target location
 * - Shows current position and teleport status
 * 
 * Teleport works by:
 * 1. Setting the right skill to Teleport (skillId=54)
 * 2. Sending a right-click action packet at the target coordinates
 * 
 * Uses: SendPacket5B (cmd, x, y) → 5-byte packet for skill target
 * And: HandleSelectSkill / SetRightSkill to switch to teleport
 * 
 * NOTE: Actually sending packets requires C++ binding support.
 * This plugin currently provides the framework + position tracking.
 */

import {
  Text, TextColored, Separator, SeparatorText, Spacing,
  Checkbox, SliderInt, Button, SameLine
} from 'gui';
import { UnitTypes } from 'nyx:d2r';
import { readMemory } from 'nyx:memory';
import { io, Key } from 'gui';

const memBinding = internalBinding('memory');
const d2rBinding = internalBinding('d2r');

// ─── Constants ───────────────────────────────────────────────────

const SKILL_TELEPORT = 54;
const TELEPORT_RANGE = 35;  // max teleport range in subtiles (~35 for Teleport)

// ─── Helpers ─────────────────────────────────────────────────────

function getBaseAddress() {
  const hashTableAddr = d2rBinding.getClientSideUnitHashTableAddress();
  return hashTableAddr - 0x1E9E350n;
}

let cachedBase = null;
function base() {
  if (cachedBase === null) cachedBase = getBaseAddress();
  return cachedBase;
}

function readUint16(address) {
  const buf = memBinding.readMemory(address, 2);
  return new DataView(buf.buffer, buf.byteOffset, 2).getUint16(0, true);
}

function readUint32(address) {
  const buf = memBinding.readMemory(address, 4);
  return new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
}

/**
 * Calculate distance between two points
 */
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate a point along a line from (x1,y1) to (x2,y2) at maxDist
 */
function clampToRange(x1, y1, x2, y2, maxDist) {
  const dist = distance(x1, y1, x2, y2);
  if (dist <= maxDist) return { x: x2, y: y2 };

  const ratio = maxDist / dist;
  return {
    x: Math.round(x1 + (x2 - x1) * ratio),
    y: Math.round(y1 + (y2 - y1) * ratio),
  };
}

/**
 * Break a long-distance teleport into a chain of steps
 */
function planTeleportChain(fromX, fromY, toX, toY, range) {
  const steps = [];
  let curX = fromX;
  let curY = fromY;

  while (distance(curX, curY, toX, toY) > range) {
    const next = clampToRange(curX, curY, toX, toY, range);
    steps.push({ x: next.x, y: next.y });
    curX = next.x;
    curY = next.y;
  }

  // Final step to destination
  if (curX !== toX || curY !== toY) {
    steps.push({ x: toX, y: toY });
  }

  return steps;
}

// ─── Plugin Registration ─────────────────────────────────────────

function registerAutoTele(manager, objMgr) {
  let tickInterval = null;
  let teleChain = [];
  let teleChainIndex = 0;
  let isTeleporting = false;
  let lastTeleTime = 0;

  const config = {
    enabled: false,
    hotkey: Key.F5,
    teleRange: TELEPORT_RANGE,
    teleDelayMs: 150,   // delay between chain teleports
    targetX: 0,
    targetY: 0,
    hasTarget: false,
  };

  // UI references
  let posText = null;
  let targetText = null;
  let chainText = null;
  let statusText = null;

  function getPlayerPos() {
    const me = objMgr.me;
    if (!me || !me.isValid) return null;
    return { x: me.posX, y: me.posY };
  }

  function startTeleChain(destX, destY) {
    const pos = getPlayerPos();
    if (!pos) {
      console.log('[AutoTele] No player position available');
      return;
    }

    teleChain = planTeleportChain(pos.x, pos.y, destX, destY, config.teleRange);
    teleChainIndex = 0;
    isTeleporting = true;

    console.log(`[AutoTele] Planned ${teleChain.length} teleport steps from (${pos.x},${pos.y}) to (${destX},${destY})`);

    if (chainText) {
      chainText.text = `Chain: ${teleChain.length} steps planned`;
    }
  }

  function executeTeleStep() {
    if (!isTeleporting || teleChainIndex >= teleChain.length) {
      isTeleporting = false;
      if (statusText) statusText.text = 'Status: Idle';
      return;
    }

    const now = Date.now();
    if (now - lastTeleTime < config.teleDelayMs) return;

    const step = teleChain[teleChainIndex];

    // TODO: Actually send the teleport packet here
    // This requires either:
    //   1. A binding.sendPacket(cmd, x, y) exposed from C++
    //   2. Or calling SendPacket5B via a function call binding
    //
    // For now, log the step
    console.log(`[AutoTele] Step ${teleChainIndex + 1}/${teleChain.length}: tele to (${step.x}, ${step.y})`);

    if (statusText) {
      statusText.text = `Teleporting: step ${teleChainIndex + 1}/${teleChain.length}`;
    }

    lastTeleTime = now;
    teleChainIndex++;

    if (teleChainIndex >= teleChain.length) {
      isTeleporting = false;
      if (statusText) statusText.text = 'Status: Complete';
      if (chainText) chainText.text = 'Chain: Done';
    }
  }

  function tick() {
    if (!config.enabled) return;

    // Update position display
    const pos = getPlayerPos();
    if (pos && posText) {
      posText.text = `Position: (${pos.x}, ${pos.y})`;
    }

    // Check hotkey
    if (io.isKeyPressed(config.hotkey, false)) {
      if (config.hasTarget) {
        console.log(`[AutoTele] Hotkey pressed — teleporting to (${config.targetX}, ${config.targetY})`);
        startTeleChain(config.targetX, config.targetY);
      } else {
        console.log('[AutoTele] Hotkey pressed but no target set');
      }
    }

    // Execute chain steps
    if (isTeleporting) {
      executeTeleStep();
    }
  }

  manager.register('auto-tele', {
    name: 'Auto Teleport',
    description: 'Teleport chain navigation (Sorceress / Enigma)',
    enabledByDefault: false,

    onEnable() {
      config.enabled = true;
      if (!tickInterval) {
        tickInterval = setInterval(tick, 50);
      }
    },

    onDisable() {
      config.enabled = false;
      isTeleporting = false;
      teleChain = [];
      if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
      }
    },

    buildUI(container) {
      container.add(new SeparatorText('Status'));

      statusText = new Text('Status: Idle');
      container.add(statusText);

      posText = new Text('Position: --');
      container.add(posText);

      targetText = new Text('Target: Not set');
      container.add(targetText);

      chainText = new Text('Chain: --');
      container.add(chainText);

      // Target setting
      container.add(new Spacing());
      container.add(new SeparatorText('Target'));

      const sliderX = new SliderInt('Target X###atTargetX', 0, 0, 30000);
      container.add(sliderX);
      sliderX.on('change', () => {
        config.targetX = sliderX.value;
        config.hasTarget = true;
        if (targetText) targetText.text = `Target: (${config.targetX}, ${config.targetY})`;
      });

      const sliderY = new SliderInt('Target Y###atTargetY', 0, 0, 30000);
      container.add(sliderY);
      sliderY.on('change', () => {
        config.targetY = sliderY.value;
        config.hasTarget = true;
        if (targetText) targetText.text = `Target: (${config.targetX}, ${config.targetY})`;
      });

      const btnSetCurrent = new Button('Set Target to Current Position###atSetCur');
      container.add(btnSetCurrent);
      btnSetCurrent.on('click', () => {
        const pos = getPlayerPos();
        if (pos) {
          config.targetX = pos.x;
          config.targetY = pos.y;
          config.hasTarget = true;
          sliderX.value = pos.x;
          sliderY.value = pos.y;
          if (targetText) targetText.text = `Target: (${config.targetX}, ${config.targetY})`;
        }
      });

      container.add(new SameLine());

      const btnClear = new Button('Clear Target###atClearTarget');
      container.add(btnClear);
      btnClear.on('click', () => {
        config.hasTarget = false;
        config.targetX = 0;
        config.targetY = 0;
        isTeleporting = false;
        if (targetText) targetText.text = 'Target: Not set';
      });

      // Teleport button
      container.add(new Spacing());

      const btnTele = new Button('Teleport Now###atTeleNow');
      container.add(btnTele);
      btnTele.on('click', () => {
        if (config.hasTarget) {
          startTeleChain(config.targetX, config.targetY);
        }
      });

      container.add(new SameLine());

      const btnStop = new Button('Stop###atStop');
      container.add(btnStop);
      btnStop.on('click', () => {
        isTeleporting = false;
        teleChain = [];
        if (statusText) statusText.text = 'Status: Stopped';
      });

      // Settings
      container.add(new Spacing());
      container.add(new SeparatorText('Settings'));

      const sliderRange = new SliderInt('Tele Range###atRange', config.teleRange, 10, 50);
      container.add(sliderRange);
      sliderRange.on('change', () => { config.teleRange = sliderRange.value; });

      const sliderDelay = new SliderInt('Step Delay (ms)###atDelay', config.teleDelayMs, 50, 1000);
      container.add(sliderDelay);
      sliderDelay.on('change', () => { config.teleDelayMs = sliderDelay.value; });

      container.add(new Spacing());
      container.add(new TextColored(
        'Hotkey: F5 to teleport to target.\n' +
        'Note: Packet sending requires C++ binding support.\n' +
        'Currently plans the chain and logs steps.',
        0.8, 0.6, 0.2, 1.0
      ));
    },
  });
}

export { registerAutoTele };
