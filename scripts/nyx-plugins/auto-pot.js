'use strict';

/**
 * Auto Potion Plugin (v3)
 *
 * Stat reading — uses BOTH approaches from friend's item_utils.cpp:
 *   1. FullStats (aggregated, +0xA8/+0xB0) if flag bit 31 is set
 *   2. BaseStats (+0x30/+0x38) + walk children (+0x90 first, +0x68 next)
 *
 * Each stat entry is 8 bytes:
 *   byte[0-1] = sub_stat (layer/param)   ← LOW 16 bits of key
 *   byte[2-3] = stat_id                  ← HIGH 16 bits of key
 *   byte[4-7] = value (int32)
 *
 * HP/Mana values are << 8 (shift right 8 for display value).
 */

import {
  Text, TextColored, SeparatorText, Spacing,
  Checkbox, InputInt
} from 'gui';

const memBinding = internalBinding('memory');

const STATS = { HP: 6, MAX_HP: 7, MANA: 8, MAX_MANA: 9 };

// ─── Memory Helpers ──────────────────────────────────────────────

function readPtr(addr) {
  const b = memBinding.readMemory(addr, 8);
  return new DataView(b.buffer, b.byteOffset, 8).getBigUint64(0, true);
}

function readU32(addr) {
  const b = memBinding.readMemory(addr, 4);
  return new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);
}

function searchStatArray(arrayPtr, count, statId) {
  if (arrayPtr === 0n || count === 0 || count > 2048) return null;
  const bytes = count * 8;
  const buf = memBinding.readMemory(arrayPtr, bytes);
  const view = new DataView(buf.buffer, buf.byteOffset, bytes);

  for (let i = 0; i < count; i++) {
    const off = i * 8;
    // key layout: low16 = sub_stat, high16 = stat_id
    // So stat_id is at byte offset +2 as uint16 LE
    const sid = view.getUint16(off + 2, true);
    if (sid === statId) {
      return view.getInt32(off + 4, true);
    }
  }
  return null;
}

/**
 * Read a stat from a unit, trying multiple approaches:
 * 1. FullStats array (aggregated with gear) if available
 * 2. BaseStats array
 * 3. Walk child stat lists (gear modifier lists)
 */
function readUnitStat(unitAddr, statId) {
  try {
    const sl = readPtr(unitAddr + 0x88n);
    if (sl === 0n) return null;

    const flags = readU32(sl + 0x08n);

    // Approach 1: FullStats (aggregated) — this has base + gear + modifiers merged
    if (flags & 0x80000000) {
      const fullArr = readPtr(sl + 0xA8n);
      const fullCnt = readU32(sl + 0xB0n);
      const val = searchStatArray(fullArr, fullCnt, statId);
      if (val !== null) return val;
    }

    // Approach 2: BaseStats
    const baseArr = readPtr(sl + 0x30n);
    const baseCnt = readU32(sl + 0x38n);
    const baseVal = searchStatArray(baseArr, baseCnt, statId);
    if (baseVal !== null) return baseVal;

    // Approach 3: Walk children (FirstChild +0x90, NextSibling +0x68)
    let child = readPtr(sl + 0x90n);
    let safety = 0;
    while (child !== 0n && safety < 64) {
      safety++;
      const cArr = readPtr(child + 0x30n);
      const cCnt = readU32(child + 0x38n);
      const cVal = searchStatArray(cArr, cCnt, statId);
      if (cVal !== null) return cVal;
      child = readPtr(child + 0x68n);
    }
  } catch (e) {}
  return null;
}

// ─── Plugin ──────────────────────────────────────────────────────

function registerAutoPot(manager, objMgr) {
  let tickInterval = null;
  let lastHpTime = 0;
  let lastMpTime = 0;

  const config = {
    enabled: false,
    hpEnabled: true,
    mpEnabled: true,
    hpThreshold: 50,
    mpThreshold: 30,
    hpColumn: 0,
    mpColumn: 1,
    cooldownMs: 500,
  };

  let hpText = null;
  let mpText = null;
  let debugText = null;

  function tick() {
    if (!config.enabled) return;
    const me = objMgr.me;
    if (!me || !me.isValid || !me.isAlive) return;

    const now = Date.now();
    const addr = me._address;

    // Debug: show stat list address
    try {
      const sl = readPtr(addr + 0x88n);
      const flags = readU32(sl + 0x08n);
      const hasFullStats = (flags & 0x80000000) ? 'YES' : 'NO';
      if (debugText) debugText.text = `StatList: 0x${sl.toString(16)} flags: 0x${flags.toString(16)} FullStats: ${hasFullStats}`;
    } catch (e) {
      if (debugText) debugText.text = `StatList: error`;
    }

    if (config.hpEnabled) {
      const hp = readUnitStat(addr, STATS.HP);
      const maxHp = readUnitStat(addr, STATS.MAX_HP);
      if (hp !== null && maxHp !== null && maxHp > 0) {
        const hpVal = hp >> 8;
        const maxVal = maxHp >> 8;
        const pct = maxVal > 0 ? (hpVal / maxVal) * 100 : 100;
        if (hpText) hpText.text = `HP: ${hpVal}/${maxVal} (${pct.toFixed(0)}%)`;
        if (pct < config.hpThreshold && (now - lastHpTime) > config.cooldownMs) {
          console.log(`[AutoPot] HP ${pct.toFixed(0)}% < ${config.hpThreshold}% — pot col ${config.hpColumn}`);
          lastHpTime = now;
        }
      } else {
        if (hpText) hpText.text = `HP: stat not found (raw hp=${hp} maxhp=${maxHp})`;
      }
    }

    if (config.mpEnabled) {
      const mp = readUnitStat(addr, STATS.MANA);
      const maxMp = readUnitStat(addr, STATS.MAX_MANA);
      if (mp !== null && maxMp !== null && maxMp > 0) {
        const mpVal = mp >> 8;
        const maxVal = maxMp >> 8;
        const pct = maxVal > 0 ? (mpVal / maxVal) * 100 : 100;
        if (mpText) mpText.text = `Mana: ${mpVal}/${maxVal} (${pct.toFixed(0)}%)`;
        if (pct < config.mpThreshold && (now - lastMpTime) > config.cooldownMs) {
          console.log(`[AutoPot] Mana ${pct.toFixed(0)}% < ${config.mpThreshold}% — pot col ${config.mpColumn}`);
          lastMpTime = now;
        }
      } else {
        if (mpText) mpText.text = `Mana: stat not found (raw mp=${mp} maxmp=${maxMp})`;
      }
    }
  }

  manager.register('auto-pot', {
    name: 'Auto Potion',
    description: 'Monitor HP/Mana, auto-pot when below threshold',
    enabledByDefault: false,

    onEnable() {
      config.enabled = true;
      if (!tickInterval) tickInterval = setInterval(tick, 100);
    },

    onDisable() {
      config.enabled = false;
      if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    },

    buildUI(container) {
      container.add(new SeparatorText('Status'));

      hpText = new TextColored('HP: --', 1.0, 0.3, 0.3, 1.0);
      container.add(hpText);

      mpText = new TextColored('Mana: --', 0.3, 0.5, 1.0, 1.0);
      container.add(mpText);

      debugText = new TextColored('StatList: --', 0.5, 0.5, 0.5, 1.0);
      container.add(debugText);

      // HP — InputInt: click +/- buttons or type value
      container.add(new Spacing());
      container.add(new SeparatorText('HP Potion'));
      container.add(new Checkbox('Enable HP Pots###apHpEn', config, 'hpEnabled'));

      const inHpThresh = new InputInt('HP Threshold %###apHpT', config.hpThreshold, 5, 10);
      container.add(inHpThresh);
      inHpThresh.on('change', () => {
        config.hpThreshold = Math.max(5, Math.min(95, inHpThresh.value));
      });

      const inHpCol = new InputInt('HP Belt Column###apHpC', config.hpColumn, 1, 1);
      container.add(inHpCol);
      inHpCol.on('change', () => {
        config.hpColumn = Math.max(0, Math.min(3, inHpCol.value));
      });

      // Mana
      container.add(new Spacing());
      container.add(new SeparatorText('Mana Potion'));
      container.add(new Checkbox('Enable Mana Pots###apMpEn', config, 'mpEnabled'));

      const inMpThresh = new InputInt('Mana Threshold %###apMpT', config.mpThreshold, 5, 10);
      container.add(inMpThresh);
      inMpThresh.on('change', () => {
        config.mpThreshold = Math.max(5, Math.min(95, inMpThresh.value));
      });

      const inMpCol = new InputInt('Mana Belt Column###apMpC', config.mpColumn, 1, 1);
      container.add(inMpCol);
      inMpCol.on('change', () => {
        config.mpColumn = Math.max(0, Math.min(3, inMpCol.value));
      });

      // Timing
      container.add(new Spacing());
      container.add(new SeparatorText('Timing'));

      const inCd = new InputInt('Cooldown (ms)###apCd', config.cooldownMs, 50, 100);
      container.add(inCd);
      inCd.on('change', () => {
        config.cooldownMs = Math.max(100, Math.min(5000, inCd.value));
      });

      container.add(new Spacing());
      container.add(new TextColored(
        'Use +/- buttons or type values directly.\n' +
        'Packet sending needs C++ binding — logs only for now.',
        0.8, 0.6, 0.2, 1.0
      ));
    },
  });
}

export { registerAutoPot };
