(function () {
  "use strict";

  const RULES = window.BLEACH_RULES;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const DISTANCE_BANDS = {
    close: { label: "贴身", order: 0, desc: "0–2m｜白打、擒拿、打断" },
    near: { label: "近距离", order: 1, desc: "2–10m｜斩术、突进、短鬼道" },
    mid: { label: "中距离", order: 2, desc: "10–40m｜鬼道、虚闪、灵子箭" },
    far: { label: "远距离", order: 3, desc: "40m以上｜狙击、撤离、大范围能力" },
  };

  const DISTANCE_ORDER = ["close", "near", "mid", "far"];
  const BODY_PARTS = ["头部/感知", "左臂", "右臂", "左腿", "右腿", "躯干", "灵魂核心/能力媒介"];
  const OBJECTIVES = {
    defeat: { label: "击败对手", rounds: null },
    escape: { label: "脱离战场", rounds: null },
    protect: { label: "保护目标", rounds: 5 },
    delay: { label: "拖延至支援抵达", rounds: 5 },
    intel: { label: "获取关键情报", rounds: null },
  };

  const DEFENSES = {
    dodge: { label: "闪避", attr: "mobility", desc: "成功可完全规避；受腿伤与狭窄空间影响" },
    block: { label: "格挡", attr: "body", desc: "稳定守位；成功时仍可能承受震伤" },
    endure: { label: "硬抗", attr: "body", desc: "保护身后目标；通常会承受部分伤害" },
    counter: { label: "反击", attr: "power", desc: "成功可反伤；失败会承受加重伤害" },
  };

  function hashNumber(text) {
    let hash = 2166136261;
    for (const char of String(text)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  function seeded(text, min, max) {
    return min + hashNumber(text) % (max - min + 1);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function rollD100(mode = "normal") {
    const first = 1 + Math.floor(Math.random() * 100);
    if (mode === "normal") return { raw: [first], value: first, mode };
    const second = 1 + Math.floor(Math.random() * 100);
    return { raw: [first, second], value: mode === "advantage" ? Math.max(first, second) : Math.min(first, second), mode };
  }

  function resultTier(margin) {
    if (margin <= -30) return { id: "severe-failure", label: "严重失败" };
    if (margin < 0) return { id: "failure", label: "失败" };
    if (margin <= 14) return { id: "narrow", label: "勉强成功" };
    if (margin <= 34) return { id: "success", label: "标准成功" };
    if (margin <= 59) return { id: "excellent", label: "优秀成功" };
    return { id: "overwhelming", label: "压倒性成功" };
  }

  function opposed(attackerScore, defenderScore, attackerMode = "normal", defenderMode = "normal", notes = []) {
    const attackerRoll = rollD100(attackerMode);
    const defenderRoll = rollD100(defenderMode);
    const attackerTotal = attackerRoll.value + attackerScore;
    const defenderTotal = defenderRoll.value + defenderScore;
    const margin = attackerTotal - defenderTotal;
    return {
      attackerRoll,
      defenderRoll,
      attackerScore,
      defenderScore,
      attackerTotal,
      defenderTotal,
      margin,
      tier: resultTier(margin),
      notes,
    };
  }

  function fixedCheck(score, dc, mode = "normal", notes = []) {
    const roll = rollD100(mode);
    const total = roll.value + score;
    const margin = total - dc;
    return { roll, score, total, dc, margin, tier: resultTier(margin), notes };
  }

  function woundInfo(score) {
    if (score <= 0) return { id: "none", label: "无伤", penalty: 0 };
    if (score < 12) return { id: "scratch", label: "擦伤", penalty: 0 };
    if (score < 28) return { id: "light", label: "轻伤", penalty: 5 };
    if (score < 48) return { id: "medium", label: "中伤", penalty: 10 };
    if (score < 68) return { id: "heavy", label: "重伤", penalty: 16 };
    if (score < 86) return { id: "spiritual", label: "严重灵体损伤", penalty: 24 };
    if (score < 106) return { id: "dying", label: "濒死", penalty: 35 };
    return { id: "dead", label: "死亡", penalty: 100 };
  }

  function spiritInfo(current, max) {
    const ratio = max ? current / max : 0;
    if (ratio >= 0.8) return "充足";
    if (ratio >= 0.58) return "稳定";
    if (ratio >= 0.35) return "明显消耗";
    if (ratio >= 0.15) return "低下";
    return "接近枯竭";
  }

  function momentumLabel(value) {
    if (value <= -3) return "被压制";
    if (value < 0) return "略被动";
    if (value === 0) return "均势";
    if (value < 3) return "略占优";
    return "掌握主动";
  }

  function distanceShift(current, delta) {
    const index = DISTANCE_ORDER.indexOf(current);
    return DISTANCE_ORDER[clamp(index + delta, 0, DISTANCE_ORDER.length - 1)];
  }

  function inferObjective(event, choice) {
    const text = `${event.name || ""} ${event.trigger || ""} ${event.outcome || ""} ${choice || ""}`;
    if (/逃|撤退|脱离|离开/.test(text)) return "escape";
    if (/保护|护送|救援|守住/.test(text)) return "protect";
    if (/拖延|等待|坚持|支援/.test(text)) return "delay";
    if (/观察|情报|调查|线索|识破/.test(text)) return "intel";
    return "defeat";
  }

  function isCombatEvent(event, choice = "") {
    const text = `${event.category || ""} ${event.name || ""} ${event.trigger || ""} ${event.outcome || ""} ${choice}`;
    if (!["accident", "world", "series"].includes(event.category) && !/攻击|战斗|袭击|追击|围堵|护送|交战/.test(text)) return false;
    return /攻击|战斗|袭击|追击|围堵|交战|敌人|虚群|破面|灭却师|保护对象|生死|战场|狩猎|决斗/.test(text);
  }

  function enemyArchetype(state, event) {
    const text = `${event.name || ""} ${event.trigger || ""}`;
    if (/灭却师|星十字|无形帝国/.test(text) || state.era === "tybw") return { name: "身份未明的灭却师", prefix: "Q", style: "ranged" };
    if (/破面|虚圈|大虚|虚/.test(text) || state.era === "arrancar" || state.location === "hueco") return { name: "身份未明的破面", prefix: "H", style: "aggressive" };
    if (/死神|瀞灵廷|斩魄刀/.test(text) || ["soul", "seireitei"].includes(state.location)) return { name: "身份未明的死神", prefix: "Z", style: "balanced" };
    return { name: "敌对灵体", prefix: "H", style: "aggressive" };
  }

  function chooseEnemyAbility(state, event, abilities, archetype) {
    const options = abilities.filter((ability) => {
      const profile = RULES.classifyAbility(ability, 62);
      return ability.id.startsWith(archetype.prefix) && profile.potency > 0 && ["attack", "control", "mobility", "defense"].includes(profile.primary);
    });
    if (!options.length) return null;
    return options[hashNumber(`${state.id}-${event.id}-enemy-ability`) % options.length];
  }

  function personalityFor(style) {
    if (style === "ranged") return { aggression: 58, defense: 64, observe: 62, keepDistance: 88, retreat: 62, risk: 44 };
    if (style === "aggressive") return { aggression: 88, defense: 32, observe: 22, keepDistance: 24, retreat: 16, risk: 86 };
    return { aggression: 62, defense: 58, observe: 48, keepDistance: 50, retreat: 45, risk: 56 };
  }

  function createCombat({ state, event, choice, abilities }) {
    const playerSheet = RULES.effectiveAttributes(state, abilities.filter((ability) => state.abilities.includes(ability.id)));
    const threat = clamp(Math.round(28 + state.worldPressure * 0.52 + ({ accident: 8, series: 14, world: 20 }[event.category] || 4)), 25, 98);
    const archetype = enemyArchetype(state, event);
    const enemyAbility = chooseEnemyAbility(state, event, abilities, archetype);
    const enemyProfile = enemyAbility ? RULES.classifyAbility(enemyAbility, clamp(threat, 35, 88)) : null;
    const objective = inferObjective(event, choice);
    const opening = opposed(
      playerSheet.effective.mobility + (state.skills.combat || 0) * 2,
      clamp(threat + seeded(`${event.id}-initiative`, -8, 8), 1, 100),
    );
    const momentum = opening.margin >= 35 ? 2 : opening.margin >= 0 ? 1 : opening.margin <= -35 ? -2 : -1;
    return {
      id: uid("combat"),
      status: "ACTIVE",
      round: 1,
      eventId: event.id,
      eventName: event.name,
      eventCategory: event.category,
      eventChoice: choice,
      eventActionId: event.actionId || null,
      eventActionCost: event.actionCost || 0,
      eventTrigger: event.trigger || "",
      eventOutcome: event.outcome || "",
      settlementType: event.settlementType || null,
      mandatory: Boolean(event.mandatory),
      location: state.location,
      distance: archetype.style === "ranged" ? "mid" : "near",
      objective,
      momentum,
      dataMode: false,
      player: {
        name: state.name,
        woundScore: clamp(Math.round((100 - state.health) * 0.75), 0, 105),
        injuries: [...(state.combatInjuries || [])],
        reiryokuCurrent: clamp(state.spiritResource, 0, playerSheet.effective.capacity),
        reiryokuMax: playerSheet.effective.capacity,
        form: null,
        formDrain: 0,
        intel: 0,
        intelProgress: 0,
        guarded: false,
      },
      enemy: {
        name: archetype.name,
        revealedName: archetype.name,
        style: archetype.style,
        attributes: {
          body: clamp(threat + seeded(`${event.id}-body`, -8, 8), 1, 100),
          mobility: clamp(threat + seeded(`${event.id}-move`, -9, 9), 1, 100),
          power: clamp(threat + seeded(`${event.id}-power`, -6, 10), 1, 100),
          resistance: clamp(threat + seeded(`${event.id}-resist`, -9, 9), 1, 100),
          control: clamp(threat + seeded(`${event.id}-control`, -10, 10), 1, 100),
          insight: clamp(threat + seeded(`${event.id}-insight`, -10, 10), 1, 100),
          will: clamp(threat + seeded(`${event.id}-will`, -8, 8), 1, 100),
          capacity: clamp(threat + seeded(`${event.id}-capacity`, -5, 12), 1, 100),
        },
        skill: clamp(Math.round(threat / 12), 1, 8),
        woundScore: 0,
        injuries: [],
        reiryokuCurrent: clamp(threat + 20, 25, 100),
        reiryokuMax: clamp(threat + 20, 25, 100),
        abilityId: enemyAbility?.id || null,
        abilityName: enemyAbility?.name || "基础灵力攻击",
        abilityMechanism: enemyAbility?.mechanism || "以灵压与身体能力进行直接攻击。",
        abilityProfile: enemyProfile,
        personality: personalityFor(archetype.style),
        intelAboutPlayer: 0,
      },
      log: [{
        id: uid("combat-log"),
        round: 0,
        title: "战斗开始",
        narration: `冲突已经无法用普通事件处理。双方在${DISTANCE_BANDS[archetype.style === "ranged" ? "mid" : "near"].label}展开对峙，你的目标是「${OBJECTIVES[objective].label}」。`,
        checks: [opening],
      }],
      outcome: null,
      startedAt: Date.now(),
    };
  }

  function abilityRange(ability, profile) {
    const text = `${ability.name || ""} ${ability.mechanism || ""} ${ability.effect || ""}`;
    if (/全场|范围|领域|远程|狙击|箭|虚闪|光束|炮|月牙|射击/.test(text)) return ["near", "mid", "far"];
    if (profile.primary === "mobility") return ["close", "near", "mid", "far"];
    if (["control", "perception", "support"].includes(profile.primary)) return ["near", "mid"];
    if (profile.primary === "release") return ["close", "near", "mid", "far"];
    return ["close", "near"];
  }

  function injuryPenalty(combatant, action) {
    let penalty = 0;
    const wound = woundInfo(combatant.woundScore);
    penalty += wound.penalty;
    combatant.injuries.forEach((injury) => {
      if (/腿/.test(injury.part) && ["move", "dodge", "flee"].includes(action)) penalty += injury.severity >= 2 ? 8 : 4;
      if (/臂/.test(injury.part) && ["attack", "block", "counter", "ability"].includes(action)) penalty += injury.severity >= 2 ? 8 : 4;
      if (/头部/.test(injury.part) && ["observe", "attack"].includes(action)) penalty += injury.severity >= 2 ? 7 : 3;
      if (/躯干|灵魂核心/.test(injury.part) && ["ability", "endure"].includes(action)) penalty += injury.severity >= 2 ? 9 : 4;
    });
    return clamp(penalty, 0, 42);
  }

  function applyWound(target, damage, forcedPart = null) {
    if (damage <= 0) return { damage: 0, part: null, wound: woundInfo(target.woundScore) };
    target.woundScore = clamp(target.woundScore + damage, 0, 120);
    const part = forcedPart || BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
    const severity = damage >= 14 ? 3 : damage >= 8 ? 2 : 1;
    const existing = target.injuries.find((item) => item.part === part);
    if (existing) existing.severity = clamp(existing.severity + (severity >= 2 ? 1 : 0), 1, 3);
    else target.injuries.push({ part, severity });
    return { damage, part, wound: woundInfo(target.woundScore) };
  }

  function spendSpirit(combatant, amount) {
    combatant.reiryokuCurrent = clamp(combatant.reiryokuCurrent - amount, 0, combatant.reiryokuMax);
  }

  function attackDamage(attackerAttributes, defenderAttributes, abilityProfile, activeForm, margin, defenseType = "dodge") {
    const weaponBase = abilityProfile ? clamp(Math.round(abilityProfile.potency * 0.38), 2, 6) : 2;
    const releaseBonus = activeForm?.releaseBonus || (abilityProfile?.primary === "release" ? abilityProfile.releaseBonus : 0);
    const marginScale = margin >= 60 ? 1.5 : margin >= 35 ? 1.25 : margin >= 15 ? 1 : 0.72;
    let reduction = Math.floor(defenderAttributes.body / 4);
    if (defenseType === "block") reduction += 3;
    if (defenseType === "endure") reduction += 5;
    const raw = Math.floor(attackerAttributes.power / 4) + weaponBase + releaseBonus;
    return clamp(Math.round(raw * marginScale - reduction), 0, 30);
  }

  function bestOwnedAbility(context, role) {
    return context.ownedAbilities
      .map((ability) => ({ ability, profile: RULES.classifyAbility(ability, context.state.abilityMastery[ability.id] || 0) }))
      .filter((item) => item.profile.primary === role)
      .sort((a, b) => b.profile.potency - a.profile.potency)[0] || null;
  }

  function addLog(combat, title, narration, checks = [], data = {}) {
    combat.log.unshift({ id: uid("combat-log"), round: combat.round, title, narration, checks, data });
    combat.log = combat.log.slice(0, 120);
  }

  function resolveMovement(combat, movement, context, customBonus = 0) {
    if (!movement || movement === "hold") return { ok: true, text: "你保持当前距离。", checks: [] };
    const attrs = RULES.effectiveAttributes(context.state, context.ownedAbilities).effective;
    const movePenalty = injuryPenalty(combat.player, "move");
    const enemyMovePenalty = injuryPenalty(combat.enemy, "move");
    const check = opposed(
      attrs.mobility + (context.state.skills.combat || 0) * 2 - movePenalty + customBonus,
      combat.enemy.attributes.mobility + combat.enemy.skill * 2 - enemyMovePenalty,
      customBonus >= 10 ? "advantage" : "normal",
    );
    if (movement === "flank") {
      if (check.margin >= 0) {
        combat.momentum = clamp(combat.momentum + 1, -4, 4);
        return { ok: true, text: "你成功绕到更有利的侧向，下一次主要行动获得位置优势。", checks: [check], flank: 10 };
      }
      combat.momentum = clamp(combat.momentum - 1, -4, 4);
      return { ok: true, text: "对方识破了绕侧意图，没有暴露侧后方。", checks: [check], flank: 0 };
    }
    const delta = movement === "approach" ? -1 : 1;
    if (check.margin >= 0) {
      const before = combat.distance;
      combat.distance = distanceShift(combat.distance, delta);
      combat.momentum = clamp(combat.momentum + 1, -4, 4);
      return { ok: true, text: `机动成功：${DISTANCE_BANDS[before].label} → ${DISTANCE_BANDS[combat.distance].label}。`, checks: [check] };
    }
    combat.momentum = clamp(combat.momentum - 1, -4, 4);
    return { ok: true, text: `对方控制住了节奏，距离仍是${DISTANCE_BANDS[combat.distance].label}。`, checks: [check] };
  }

  function enemyReaction(combat) {
    const enemy = combat.enemy;
    if (enemy.personality.aggression > 76 && enemy.woundScore < 48 && Math.random() < 0.32) return "counter";
    if (enemy.attributes.mobility >= enemy.attributes.body || enemy.style === "ranged") return "dodge";
    return enemy.personality.defense > 60 ? "block" : "endure";
  }

  function resolvePlayerAttack(combat, input, context, positionBonus) {
    const attrs = RULES.effectiveAttributes(context.state, context.ownedAbilities).effective;
    let ability = null;
    let profile = null;
    if (input.action === "ability") {
      ability = context.ownedAbilities.find((item) => item.id === input.abilityId);
      if (!ability) return { ok: false, error: "这项能力尚未掌握。" };
      profile = RULES.classifyAbility(ability, context.state.abilityMastery[ability.id] || 0);
      if (profile.primary === "release") {
        if (combat.player.form?.abilityId === ability.id) return { ok: false, error: "当前已经维持该形态。" };
        if (combat.player.reiryokuCurrent < profile.cost) return { ok: false, error: "灵力不足，无法完成形态解放。" };
        spendSpirit(combat.player, profile.cost);
        combat.player.form = { abilityId: ability.id, name: ability.name, releaseBonus: profile.releaseBonus, activatedRound: combat.round };
        combat.player.formDrain = clamp(Math.round(profile.cost * 0.3), 3, 8);
        combat.momentum = clamp(combat.momentum + 1, -4, 4);
        return { ok: true, text: `你解放了「${ability.name}」。灵压与战斗方式随之改变，每回合将持续消耗灵力。`, checks: [] };
      }
      if (!abilityRange(ability, profile).includes(combat.distance)) {
        if (input.movement && input.movement !== "hold") {
          return { ok: true, text: `你完成了移动，但仍未进入「${ability.name}」的有效范围，本回合没有形成攻击。`, checks: [] };
        }
        return { ok: false, error: `「${ability.name}」无法在${DISTANCE_BANDS[combat.distance].label}有效发动。` };
      }
      if (combat.player.reiryokuCurrent < profile.cost) return { ok: false, error: "当前灵力不足以发动这项能力。" };
      spendSpirit(combat.player, profile.cost);
    } else if (!["close", "near"].includes(combat.distance)) {
      if (input.movement && input.movement !== "hold") {
        return { ok: true, text: "你完成了移动，但仍未进入普通攻击距离，本回合没有形成有效斩击。", checks: [] };
      }
      return { ok: false, error: `普通攻击无法跨越${DISTANCE_BANDS[combat.distance].label}。请先逼近或使用远程能力。` };
    }

    const reaction = enemyReaction(combat);
    const defenderAttr = reaction === "dodge" ? "mobility" : reaction === "counter" ? "power" : "body";
    const attackPenalty = injuryPenalty(combat.player, ability ? "ability" : "attack");
    const defensePenalty = injuryPenalty(combat.enemy, reaction);
    const lowSpiritPenalty = combat.player.reiryokuCurrent / combat.player.reiryokuMax < 0.15 ? 10 : 0;
    const check = opposed(
      attrs.power + (context.state.skills.combat || 0) * 2 + (profile?.potency || 0) + positionBonus - attackPenalty - lowSpiritPenalty,
      combat.enemy.attributes[defenderAttr] + combat.enemy.skill * 2 - defensePenalty,
      positionBonus >= 10 ? "advantage" : "normal",
    );
    const actionName = ability?.name || "普通斩击 / 白打";
    if (check.margin >= 0) {
      const damage = attackDamage(attrs, combat.enemy.attributes, profile, combat.player.form, check.margin, reaction);
      const wound = applyWound(combat.enemy, damage);
      combat.momentum = clamp(combat.momentum + (check.margin >= 35 ? 2 : 1), -4, 4);
      if (ability) {
        context.state.abilityMastery[ability.id] = clamp((context.state.abilityMastery[ability.id] || 0) + 1, 0, 100);
        combat.player.intelProgress += 0.12;
      }
      return { ok: true, text: `${actionName}突破了对方的${DEFENSES[reaction].label}，命中${wound.part || "目标"}。敌方伤势变为「${wound.wound.label}」。`, checks: [check], damage };
    }
    combat.momentum = clamp(combat.momentum - (check.margin <= -30 ? 2 : 1), -4, 4);
    if (reaction === "counter" && check.margin <= -15) {
      const damage = attackDamage(combat.enemy.attributes, attrs, combat.enemy.abilityProfile, null, Math.abs(check.margin), "dodge");
      const wound = applyWound(combat.player, damage);
      return { ok: true, text: `${actionName}被对方看穿，对方在错身时完成反击，你的${wound.part}受创，当前「${wound.wound.label}」。`, checks: [check], damageTaken: damage };
    }
    return { ok: true, text: `${actionName}没有突破对方的${DEFENSES[reaction].label}，你失去了部分主动权。`, checks: [check] };
  }

  function resolvePlayerMain(combat, input, context, positionBonus) {
    if (["attack", "ability"].includes(input.action)) return resolvePlayerAttack(combat, input, context, positionBonus);
    const attrs = RULES.effectiveAttributes(context.state, context.ownedAbilities).effective;
    if (input.action === "observe") {
      const repeatedBonus = combat.player.intelProgress >= 0.5 ? 10 : 0;
      const observeDc = 70 + Math.round(combat.enemy.attributes.insight * 0.6);
      const check = fixedCheck(attrs.insight + (context.state.skills.combat || 0) * 2 - injuryPenalty(combat.player, "observe") + repeatedBonus, observeDc, combat.momentum > 1 ? "advantage" : "normal");
      if (check.margin >= 0) {
        const gain = check.margin >= 35 ? 2 : 1;
        combat.player.intel = clamp(combat.player.intel + gain, 0, 4);
        combat.player.intelProgress = 0;
        combat.momentum = clamp(combat.momentum + 1, -4, 4);
        return { ok: true, text: `你从动作、灵压流向与媒介中确认了新的规律，敌方情报提升至等级${combat.player.intel}。`, checks: [check] };
      }
      combat.player.intelProgress = clamp(combat.player.intelProgress + 0.35, 0, 1);
      return { ok: true, text: "你捕捉到了一些迹象，但还不足以确认完整规律。重复观察会获得修正。", checks: [check] };
    }
    if (input.action === "flee") {
      const check = opposed(attrs.mobility + (context.state.skills.combat || 0) * 2 - injuryPenalty(combat.player, "flee"), combat.enemy.attributes.mobility + combat.enemy.skill * 2);
      if (check.margin >= 0) {
        if (combat.distance === "far") {
          finishCombat(combat, "ESCAPED", "你摆脱追击并离开战场。", combat.objective === "escape" || combat.objective === "intel");
          return { ok: true, text: "你利用出口与距离优势成功脱离战场。", checks: [check] };
        }
        combat.distance = distanceShift(combat.distance, 1);
        return { ok: true, text: `你向出口撤离，距离扩大到${DISTANCE_BANDS[combat.distance].label}。`, checks: [check] };
      }
      return { ok: true, text: "对方封住了主要退路，你暂时无法脱离。", checks: [check] };
    }
    if (input.action === "negotiate") {
      const check = opposed(attrs.will + Math.round(attrs.insight * 0.5) + (context.state.skills.social || 0) * 2, combat.enemy.attributes.will + combat.enemy.skill * 2);
      const canAccept = combat.enemy.style !== "aggressive" || combat.enemy.woundScore >= 45 || combat.player.woundScore >= 68;
      if (check.margin >= 15 && canAccept) {
        finishCombat(combat, "NEGOTIATED", "双方停止即时交战，后果将转入事件与关系系统。", combat.objective !== "defeat");
        return { ok: true, text: "你的条件击中了对方当前目标的空隙，对方接受暂时停战。", checks: [check] };
      }
      return { ok: true, text: canAccept ? "对方没有接受当前条件，但短暂的交涉让局势稍微降温。" : "对方当前目标与人格不允许简单退出，交涉没有终止战斗。", checks: [check] };
    }
    if (input.action === "protect") {
      combat.player.guarded = true;
      combat.momentum = clamp(combat.momentum + 1, -4, 4);
      return { ok: true, text: "你收缩站位，把自己放在攻击路线与保护目标之间。下一次防御获得修正。", checks: [] };
    }
    return { ok: false, error: "请选择一个有效主要行动。" };
  }

  function enemyCanUseAbility(combat) {
    const profile = combat.enemy.abilityProfile;
    if (!profile || combat.enemy.reiryokuCurrent < profile.cost) return false;
    const fakeAbility = { name: combat.enemy.abilityName, mechanism: combat.enemy.abilityMechanism, effect: "" };
    return abilityRange(fakeAbility, profile).includes(combat.distance);
  }

  function resolveEnemyAttack(combat, defense, context) {
    const attrs = RULES.effectiveAttributes(context.state, context.ownedAbilities).effective;
    const useAbility = enemyCanUseAbility(combat) && (combat.distance === "mid" || combat.distance === "far" || Math.random() < 0.5);
    const profile = useAbility ? combat.enemy.abilityProfile : null;
    if (useAbility) spendSpirit(combat.enemy, profile.cost);
    const defenseDef = DEFENSES[defense] || DEFENSES.dodge;
    const defenseAbility = defense === "block" || defense === "endure" ? bestOwnedAbility(context, "defense") : defense === "dodge" ? bestOwnedAbility(context, "mobility") : bestOwnedAbility(context, "attack");
    const playerDefenseScore = attrs[defenseDef.attr] + (context.state.skills.combat || 0) * 2 + (defenseAbility?.profile.potency || 0) + (combat.player.guarded ? 10 : 0) - injuryPenalty(combat.player, defense);
    const attackScore = combat.enemy.attributes.power + combat.enemy.skill * 2 + (profile?.potency || 0) - injuryPenalty(combat.enemy, useAbility ? "ability" : "attack");
    const check = opposed(attackScore, playerDefenseScore, combat.momentum <= -3 ? "advantage" : "normal");
    combat.player.guarded = false;
    const attackName = useAbility ? combat.enemy.abilityName : "直接攻击";
    combat.player.intelProgress = clamp(combat.player.intelProgress + (useAbility ? 0.42 : 0.12), 0, 1);
    if (check.margin >= 0 || defense === "endure") {
      let damage = attackDamage(combat.enemy.attributes, attrs, profile, null, Math.max(0, check.margin), defense);
      if (defense === "endure") damage = Math.max(1, Math.ceil(damage * 0.65));
      if (defense === "block" && check.margin < 15) damage = Math.ceil(damage * 0.55);
      if (defense === "counter" && check.margin >= 0) damage = Math.ceil(damage * 1.25);
      const wound = applyWound(combat.player, damage);
      combat.momentum = clamp(combat.momentum - (check.margin >= 35 ? 2 : 1), -4, 4);
      return { text: `${attackName}压过了你的${defenseDef.label}，${wound.part || "身体"}受创；当前伤势「${wound.wound.label}」。`, checks: [check], damage };
    }
    combat.momentum = clamp(combat.momentum + 1, -4, 4);
    if (defense === "counter" && check.margin <= -15) {
      const damage = attackDamage(attrs, combat.enemy.attributes, defenseAbility?.profile, combat.player.form, Math.abs(check.margin), "dodge");
      const wound = applyWound(combat.enemy, damage);
      return { text: `你在化解${attackName}的同时完成反击，对方${wound.part}受伤；敌方状态变为「${wound.wound.label}」。`, checks: [check], counterDamage: damage };
    }
    return { text: `你用${defenseDef.label}化解了${attackName}，没有形成有效伤害。`, checks: [check] };
  }

  function resolveEnemyTurn(combat, defense, context) {
    if (combat.status !== "ACTIVE") return { text: "战斗已经结束。", checks: [] };
    const enemy = combat.enemy;
    const wound = woundInfo(enemy.woundScore);
    if (wound.id === "dying" || wound.id === "dead") {
      finishCombat(combat, wound.id === "dead" ? "ENEMY_DEAD" : "ENEMY_DEFEATED", "敌方失去继续战斗的能力。", combat.objective === "defeat");
      return { text: "对方已经无法维持正常行动。", checks: [] };
    }
    if (enemy.woundScore >= 60 && Math.random() * 100 < enemy.personality.retreat) {
      enemy.reiryokuCurrent = clamp(enemy.reiryokuCurrent - 3, 0, enemy.reiryokuMax);
      combat.distance = distanceShift(combat.distance, 1);
      if (combat.distance === "far" && enemy.woundScore >= 68) {
        finishCombat(combat, "ENEMY_ESCAPED", "敌方判断继续作战不符合目标并成功撤离。", combat.objective === "defeat" || combat.objective === "delay");
      }
      return { text: `对方没有继续硬拼，而是主动拉开到${DISTANCE_BANDS[combat.distance].label}。`, checks: [] };
    }
    if ((combat.distance === "far" || combat.distance === "mid") && !enemyCanUseAbility(combat)) {
      const before = combat.distance;
      combat.distance = distanceShift(combat.distance, -1);
      return { text: `对方为了进入有效攻击距离，从${DISTANCE_BANDS[before].label}逼近到${DISTANCE_BANDS[combat.distance].label}。`, checks: [] };
    }
    if (enemy.personality.observe > 55 && enemy.intelAboutPlayer < 2 && Math.random() < 0.22) {
      enemy.intelAboutPlayer += 1;
      combat.momentum = clamp(combat.momentum - 1, -4, 4);
      return { text: "对方没有贸然进攻，而是在分析你的步法、灵压与能力媒介。", checks: [] };
    }
    return resolveEnemyAttack(combat, defense, context);
  }

  function parseCustomAction(text) {
    const value = String(text || "").trim();
    if (!value) return { ok: false, error: "请输入一句战术。" };
    const steps = [];
    const patterns = [
      ["feint", /假装|假动作|佯攻/], ["observe", /观察|分析|识破/], ["approach", /接近|逼近|冲过去/],
      ["retreat", /后退|拉开|退后/], ["flank", /绕后|绕到.*(?:后|侧)|侧面|瞬步到.*后/], ["attack", /攻击|斩击|砍|白打|射击/],
      ["protect", /保护|挡在|护住/], ["flee", /逃跑|撤离|脱离/], ["ability", /使用能力|发动|释放/],
    ];
    patterns.forEach(([id, pattern]) => { if (pattern.test(value)) steps.push(id); });
    const ordered = [...new Set(steps)].slice(0, 3);
    if (!ordered.length) return { ok: false, error: "暂时无法解析这句话。请加入“观察、接近、后退、绕后、攻击、保护、逃跑或使用能力”等动作词。" };
    const movement = ordered.includes("flank") ? "flank" : ordered.includes("approach") ? "approach" : ordered.includes("retreat") ? "retreat" : "hold";
    const action = ordered.includes("flee") ? "flee" : ordered.includes("protect") ? "protect" : ordered.includes("observe") && !ordered.includes("attack") ? "observe" : ordered.includes("ability") ? "ability" : "attack";
    return { ok: true, steps: ordered, movement, action, tacticalBonus: ordered.includes("feint") ? 10 : 0, original: value };
  }

  function checkEndConditions(combat) {
    const playerWound = woundInfo(combat.player.woundScore);
    const enemyWound = woundInfo(combat.enemy.woundScore);
    if (playerWound.id === "dead") return finishCombat(combat, "PLAYER_DEAD", "你的灵体遭到致命破坏。", false);
    if (playerWound.id === "dying") return finishCombat(combat, "PLAYER_DYING", "你已经无法进行正常主要行动，战斗进入濒死结算。", false);
    if (["dying", "dead"].includes(enemyWound.id)) return finishCombat(combat, "ENEMY_DEFEATED", "敌方失去继续战斗能力。", combat.objective === "defeat");
    if (combat.objective === "delay" && combat.round >= OBJECTIVES.delay.rounds) return finishCombat(combat, "DELAY_SUCCESS", "你坚持到支援/时间条件满足，敌方无法继续完成原目标。", true);
    if (combat.objective === "protect" && combat.round >= OBJECTIVES.protect.rounds && playerWound.id !== "dying") return finishCombat(combat, "PROTECT_SUCCESS", "保护对象坚持到安全窗口出现。", true);
    if (combat.objective === "intel" && combat.player.intel >= 3) return finishCombat(combat, "INTEL_SUCCESS", "你已经确认关键机制，可以带着情报撤出。", true);
    return null;
  }

  function resolveTurn(combat, input, context) {
    if (!combat || combat.status !== "ACTIVE") return { ok: false, error: "当前没有正在进行的战斗。" };
    let parsed = null;
    if (input.customText) {
      parsed = parseCustomAction(input.customText);
      if (!parsed.ok) return parsed;
      input = { ...input, movement: parsed.movement, action: parsed.action, tacticalBonus: parsed.tacticalBonus };
      if (parsed.action === "ability" && !input.abilityId) return { ok: false, error: "自定义战术包含“使用能力”，请同时选择具体能力。" };
    }
    if (input.action === "ability") {
      const ability = context.ownedAbilities.find((item) => item.id === input.abilityId);
      if (!ability) return { ok: false, error: "这项能力尚未掌握。" };
      const profile = RULES.classifyAbility(ability, context.state.abilityMastery[ability.id] || 0);
      if (combat.player.form?.abilityId === ability.id && profile.primary === "release") return { ok: false, error: "当前已经维持该形态。" };
      if (combat.player.reiryokuCurrent < profile.cost) return { ok: false, error: "当前灵力不足以发动这项能力。" };
    }
    const movement = resolveMovement(combat, input.movement || "hold", context, input.tacticalBonus || 0);
    const main = resolvePlayerMain(combat, input, context, movement.flank || input.tacticalBonus || 0);
    if (!main.ok) return main;
    const enemy = resolveEnemyTurn(combat, input.defense || "dodge", context);
    if (combat.player.form) {
      if (combat.player.reiryokuCurrent >= combat.player.formDrain) spendSpirit(combat.player, combat.player.formDrain);
      else {
        const formName = combat.player.form.name;
        combat.player.form = null;
        combat.player.formDrain = 0;
        enemy.text += ` 你的灵力不足，「${formName}」被迫解除。`;
      }
    }
    const customText = parsed ? `你的战术被解析为：${parsed.steps.join(" → ")}。` : "";
    addLog(combat, `第${combat.round}回合`, `${customText}${movement.text} ${main.text} ${enemy.text}`, [...movement.checks, ...(main.checks || []), ...(enemy.checks || [])], { input, player: main, enemy });
    checkEndConditions(combat);
    if (combat.status === "ACTIVE") combat.round += 1;
    return { ok: true, combat };
  }

  function chooseAutoInput(combat, context, preference = "balanced") {
    const wound = woundInfo(combat.player.woundScore);
    if (wound.penalty >= 24 || combat.player.reiryokuCurrent < combat.player.reiryokuMax * 0.12) return { action: "flee", movement: "retreat", defense: "dodge" };
    if (combat.objective === "escape") return { action: "flee", movement: "retreat", defense: "dodge" };
    if (combat.objective === "intel" && combat.player.intel < 3) return { action: "observe", movement: combat.distance === "close" ? "retreat" : "hold", defense: "dodge" };
    if (combat.objective === "protect") return { action: "protect", movement: "hold", defense: "block" };
    const abilities = context.ownedAbilities.map((ability) => ({ ability, profile: RULES.classifyAbility(ability, context.state.abilityMastery[ability.id] || 0) }))
      .filter((item) => item.profile.primary !== "release" && item.profile.cost <= combat.player.reiryokuCurrent && abilityRange(item.ability, item.profile).includes(combat.distance))
      .sort((a, b) => b.profile.potency - a.profile.potency);
    const useAbility = abilities[0] && combat.player.reiryokuCurrent > combat.player.reiryokuMax * (preference === "aggressive" ? 0.25 : 0.48);
    const movement = ["mid", "far"].includes(combat.distance) && !useAbility ? "approach" : preference === "cautious" && combat.distance === "close" ? "retreat" : "hold";
    return { action: useAbility ? "ability" : "attack", abilityId: useAbility ? abilities[0].ability.id : null, movement, defense: preference === "aggressive" ? "counter" : preference === "cautious" ? "dodge" : "block" };
  }

  function autoResolve(combat, context, preference = "balanced", maxRounds = 14) {
    const startRound = combat.round;
    while (combat.status === "ACTIVE" && combat.round < startRound + maxRounds) {
      const input = chooseAutoInput(combat, context, preference);
      const result = resolveTurn(combat, input, context);
      if (!result.ok) {
        resolveTurn(combat, { action: "observe", movement: "hold", defense: "dodge" }, context);
      }
    }
    if (combat.status === "ACTIVE") {
      const playerPower = 100 - combat.player.woundScore + combat.player.reiryokuCurrent + combat.momentum * 5;
      const enemyPower = 100 - combat.enemy.woundScore + combat.enemy.reiryokuCurrent;
      finishCombat(combat, playerPower >= enemyPower ? "TIMEOUT_ADVANTAGE" : "TIMEOUT_RETREAT", playerPower >= enemyPower ? "长时间交战后，对方选择撤出当前区域。" : "长时间交战后，你被迫撤出当前区域。", playerPower >= enemyPower && combat.objective !== "escape");
    }
    return combat;
  }

  function finishCombat(combat, code, text, objectiveSuccess) {
    combat.status = "FINISHED";
    combat.outcome = { code, text, objectiveSuccess: Boolean(objectiveSuccess), finishedRound: combat.round, finishedAt: Date.now() };
    addLog(combat, "战斗结束", `${text} 战斗目标「${OBJECTIVES[combat.objective].label}」${objectiveSuccess ? "达成" : "未完全达成"}。`, [], { outcome: combat.outcome });
    return combat.outcome;
  }

  function visibleEnemyInfo(combat) {
    const level = combat.player.intel;
    return {
      name: level >= 1 ? combat.enemy.revealedName : "身份未知的敌人",
      abilityName: level >= 2 ? combat.enemy.abilityName : "能力未知",
      mechanism: level >= 3 ? combat.enemy.abilityMechanism : level >= 1 ? "已观察到部分发动迹象" : "尚未确认",
      weakness: level >= 4 ? `能力职责：${RULES.ROLE_DEFS[combat.enemy.abilityProfile?.primary || "utility"].label}；可结合距离与发动媒介制定克制。` : "需要更高情报等级",
    };
  }

  window.BLEACH_COMBAT = {
    DISTANCE_BANDS,
    OBJECTIVES,
    DEFENSES,
    isCombatEvent,
    createCombat,
    resolveTurn,
    autoResolve,
    parseCustomAction,
    woundInfo,
    spiritInfo,
    momentumLabel,
    visibleEnemyInfo,
    abilityRange,
  };
})();
