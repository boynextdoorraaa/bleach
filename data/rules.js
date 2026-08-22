(function () {
  "use strict";

  const ATTRIBUTE_DEFS = {
    body: { label: "肉体强度", short: "肉体", desc: "力量、抗打击、躯体耐久与恢复力" },
    mobility: { label: "机动反应", short: "机动", desc: "移动速度、身法、神经反应与闪避预判" },
    power: { label: "破坏力", short: "破坏", desc: "斩击、虚闪、灵子箭与直接能力输出" },
    resistance: { label: "灵魂抗性", short: "魂抗", desc: "灵子冲击、精神侵蚀与灵魂稳固度" },
    capacity: { label: "灵源容量", short: "灵源", desc: "灵力总储备与持续释放能力" },
    control: { label: "操控造诣", short: "操控", desc: "灵子与自身能量的精细控制" },
    insight: { label: "洞察智力", short: "洞察", desc: "战术、感知、识破与局势判断" },
    will: { label: "人格意志", short: "意志", desc: "精神定力、气场与内心执念" },
  };

  const ROLE_DEFS = {
    attack: { label: "攻击·破坏", mark: "攻", desc: "直接造成伤害或压制敌方", color: "#a32322" },
    defense: { label: "防御·抗性", mark: "守", desc: "减伤、护盾、抗性与生存", color: "#355f7c" },
    mobility: { label: "机动·闪避", mark: "迅", desc: "速度、位移、追击与脱离", color: "#447563" },
    control: { label: "控制·干扰", mark: "缚", desc: "束缚、封印、幻术与状态改变", color: "#6d4f83" },
    perception: { label: "感知·侦察", mark: "察", desc: "搜索、识破、预判与情报获取", color: "#9a7123" },
    support: { label: "支援·恢复", mark: "援", desc: "治疗、修复、强化与友军支援", color: "#59803d" },
    resource: { label: "灵源·续航", mark: "源", desc: "灵子吸收、储备、塑形与持续消耗", color: "#33798b" },
    release: { label: "形态·解放", mark: "解", desc: "始解、卍解、归刃、完圣体等爆发形态", color: "#171717" },
    utility: { label: "特殊·泛用", mark: "异", desc: "规则型、媒介型与非标准用途", color: "#7a6c5f" },
  };

  const ROLE_PATTERNS = {
    release: /始解|卍解|归刃|完圣体|vollst[aä]ndig|letzt stil|解放|形态|虚化|虚面|假面|第二阶层|二段|刀剑解放|装衣/i,
    defense: /防御|防护|护盾|盾|结界|装甲|钢皮|静血装|抗性|抵抗|减伤|无效|免疫|硬化|反射|屏障|防壁|肉雫唼/i,
    mobility: /瞬步|响转|飞镰脚|高速|速度|加速|位移|移动|闪避|步法|传送|穿梭|追击|瞬间|动能/i,
    control: /控制|束缚|封印|禁锢|停止|冻结|锁定|操纵|干涉|幻术|催眠|支配|麻痹|重力|时间|空间固定|规则|改写/i,
    perception: /感知|侦察|探测|识破|洞察|预测|未来|视野|读取|灵觉|观察|追踪|索敌|看破|标记/i,
    support: /治疗|治愈|恢复|修复|再生|支援|辅助|共享|净化|复原|保护他人|增幅友军/i,
    resource: /吸收|储存|灵子|灵力|能量|蓄力|充能|圣隶|容量|吞噬|集束|回收|补充|转化/i,
    attack: /攻击|斩击|斩魄|刀|剑|虚闪|箭|射击|破坏|爆炸|雷|火|冰|毒|冲击|切割|贯穿|弹|炮|枪|伤害|拳|踢|月牙/i,
  };

  const ROLE_ATTRIBUTE_MAP = {
    attack: { power: 1 },
    defense: { body: 0.48, resistance: 1 },
    mobility: { mobility: 1 },
    control: { control: 1, insight: 0.22 },
    perception: { insight: 1, mobility: 0.18 },
    support: { resistance: 0.5, will: 0.42, control: 0.22 },
    resource: { capacity: 1, control: 0.32 },
    release: { power: 1, capacity: 0.68, body: 0.25 },
    utility: { insight: 0.42, control: 0.42 },
  };

  const DOMAIN_LABELS = {
    combat: "战斗",
    survival: "生存",
    investigation: "调查",
    social: "交涉",
    training: "训练",
    escape: "脱离",
    mental: "精神",
    world: "世界事件",
  };

  const ROLE_DOMAIN_WEIGHTS = {
    attack: { combat: 96, survival: 52, investigation: 12, social: 4, training: 58, escape: 18, mental: 8, world: 64 },
    defense: { combat: 88, survival: 98, investigation: 18, social: 5, training: 48, escape: 42, mental: 62, world: 70 },
    mobility: { combat: 80, survival: 84, investigation: 48, social: 10, training: 55, escape: 100, mental: 8, world: 58 },
    control: { combat: 92, survival: 68, investigation: 52, social: 30, training: 60, escape: 58, mental: 74, world: 72 },
    perception: { combat: 58, survival: 70, investigation: 100, social: 58, training: 48, escape: 62, mental: 86, world: 86 },
    support: { combat: 58, survival: 96, investigation: 42, social: 52, training: 62, escape: 36, mental: 70, world: 64 },
    resource: { combat: 52, survival: 62, investigation: 38, social: 8, training: 90, escape: 28, mental: 35, world: 62 },
    release: { combat: 100, survival: 80, investigation: 22, social: 3, training: 70, escape: 52, mental: 54, world: 98 },
    utility: { combat: 42, survival: 54, investigation: 82, social: 48, training: 44, escape: 48, mental: 64, world: 66 },
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function textOf(ability) {
    return `${ability.name || ""} ${ability.category || ""} ${ability.mechanism || ""} ${ability.effect || ""} ${ability.note || ""}`.toLowerCase();
  }

  function idVariation(id) {
    let hash = 0;
    for (const char of String(id || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return (hash % 5) - 2;
  }

  function abilityTier(text) {
    if (/基线|无固定能力|不是战斗技能/.test(text)) return 0;
    if (/极高|终极|天花板|第二阶层|卍解|完圣体|灵王|圣别|无月|崩玉/.test(text)) return 13;
    if (/高阶|大幅|队长|归刃|始解|虚化|强大|完全/.test(text)) return 10;
    if (/中|强化|增幅|装甲|领域/.test(text)) return 7;
    if (/低|基础|普通|标准|常态/.test(text)) return 4;
    return 6;
  }

  function classifyAbility(ability, mastery = 50) {
    const text = textOf(ability);
    const roleScores = Object.keys(ROLE_PATTERNS).map((role) => {
      const pattern = ROLE_PATTERNS[role];
      const nameScore = pattern.test(`${ability.name || ""}`) ? 62 : 0;
      const categoryScore = pattern.test(`${ability.category || ""}`) ? 38 : 0;
      const effectScore = pattern.test(`${ability.effect || ""}`) ? 30 : 0;
      const mechanismScore = pattern.test(`${ability.mechanism || ""}`) ? (role === "release" ? 10 : 22) : 0;
      const noteScore = role === "release" ? 0 : pattern.test(`${ability.note || ""}`) ? 7 : 0;
      return [role, nameScore + categoryScore + effectScore + mechanismScore + noteScore];
    }).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
    const roles = roleScores.map(([role]) => role);
    if (!roles.length) roles.push("utility");
    const primary = roles[0];
    const masteryFactor = 0.32 + clamp(mastery, 0, 100) / 100 * 0.68;
    const tier = abilityTier(text);
    const potency = tier === 0 ? 0 : clamp(Math.round((tier + idVariation(ability.id)) * masteryFactor), 1, 15);
    const bonuses = {};
    roles.slice(0, 3).forEach((role, index) => {
      const scale = index === 0 ? 1 : index === 1 ? 0.34 : 0.2;
      Object.entries(ROLE_ATTRIBUTE_MAP[role] || {}).forEach(([key, ratio]) => {
        bonuses[key] = (bonuses[key] || 0) + Math.max(1, Math.round(potency * ratio * scale));
      });
    });
    if (tier === 0) Object.keys(bonuses).forEach((key) => { bonuses[key] = 0; });
    const domainWeights = {};
    Object.keys(DOMAIN_LABELS).forEach((domain) => {
      domainWeights[domain] = Math.max(...roles.map((role, index) => Math.round((ROLE_DOMAIN_WEIGHTS[role]?.[domain] || 0) * (index ? 0.86 : 1))));
    });
    const releaseBonus = primary === "release" && potency ? clamp(8 + Math.round(potency / 2), 8, 15) : 0;
    const cost = potency === 0 ? 0 : clamp(Math.round(2 + potency * 0.65 + (primary === "release" ? 5 : 0)), 2, 18);
    return { primary, roles, potency, bonuses, domainWeights, releaseBonus, cost, mastery };
  }

  function aggregateAbilityBonuses(abilities, masteryMap = {}) {
    const totals = Object.fromEntries(Object.keys(ATTRIBUTE_DEFS).map((key) => [key, 0]));
    const breakdown = [];
    abilities.forEach((ability) => {
      const profile = classifyAbility(ability, masteryMap[ability.id] || 0);
      Object.entries(profile.bonuses).forEach(([key, value]) => { totals[key] += value; });
      breakdown.push({ ability, profile });
    });
    Object.keys(totals).forEach((key) => { totals[key] = clamp(totals[key], 0, 28); });
    return { totals, breakdown };
  }

  function effectiveAttributes(state, abilities) {
    const aggregate = aggregateAbilityBonuses(abilities, state.abilityMastery || {});
    const condition = {
      body: state.health < 40 ? -12 : state.health < 70 ? -6 : 0,
      mobility: -(state.fatigue >= 75 ? 14 : state.fatigue >= 50 ? 7 : state.fatigue >= 30 ? 3 : 0),
      power: state.health < 45 ? -6 : 0,
      resistance: state.soulStability < 45 ? -10 : state.soulStability < 65 ? -4 : 0,
      capacity: 0,
      control: -(state.fatigue >= 75 ? 10 : state.fatigue >= 50 ? 5 : 0),
      insight: -(state.fatigue >= 75 ? 10 : state.fatigue >= 50 ? 5 : 0),
      will: state.health < 25 ? -5 : 0,
    };
    const effective = {};
    Object.keys(ATTRIBUTE_DEFS).forEach((key) => {
      effective[key] = clamp(Math.round((state.attributes?.[key] || 1) + aggregate.totals[key] + condition[key]), 1, 100);
    });
    return { base: { ...state.attributes }, bonuses: aggregate.totals, condition, effective, breakdown: aggregate.breakdown };
  }

  function eventDomains(event, choice = "") {
    const text = `${event.category || ""} ${event.name || ""} ${event.trigger || ""} ${event.outcome || ""} ${choice}`;
    const domains = [];
    if (["accident", "series", "world"].includes(event.category) || /战|攻击|敌|斩|虚|追击|袭击|护送|冲突|防守|狩猎|破坏/.test(text)) domains.push("combat");
    if (/危险|受伤|救|保护|防御|生存|事故|灾|撤退/.test(text)) domains.push("survival");
    if (event.category === "exploration" || /调查|线索|情报|观察|寻找|识破|追查|异常|痕迹/.test(text)) domains.push("investigation");
    if (["social", "relationship"].includes(event.category) || /社交|关系|谈判|交流|请求|邀请|信任/.test(text)) domains.push("social");
    if (event.category === "growth" || /训练|修行|学习|掌握|觉醒|突破/.test(text)) domains.push("training");
    if (/撤退|逃|脱离|闪避|躲|追击|移动/.test(text)) domains.push("escape");
    if (/幻术|精神|侵蚀|虚化反噬|恐惧|意志|催眠|心灵|人格|污染/.test(text)) domains.push("mental");
    if (["series", "world", "choice"].includes(event.category) || /世界|战争|灵王|队长|组织|大事件/.test(text)) domains.push("world");
    return [...new Set(domains.length ? domains : ["investigation"])];
  }

  function scoreAbilityForEvent(ability, mastery, event, choice = "") {
    const profile = classifyAbility(ability, mastery);
    const domains = eventDomains(event, choice);
    const weight = Math.round(domains.reduce((sum, domain) => sum + profile.domainWeights[domain], 0) / domains.length);
    const checkBonus = profile.potency ? clamp(Math.round(profile.potency * weight / 100), 0, 15) : 0;
    return { ability, profile, domains, weight, checkBonus };
  }

  function attributeScaleLabel(value) {
    if (value <= 20) return "普通凡人";
    if (value <= 40) return "微弱灵能 / 实习";
    if (value <= 60) return "普通战斗人员";
    if (value <= 75) return "席官 / 大虚级";
    if (value <= 88) return "副队长级";
    if (value <= 95) return "队长级";
    return "天花板级";
  }

  window.BLEACH_RULES = {
    ATTRIBUTE_DEFS,
    ROLE_DEFS,
    DOMAIN_LABELS,
    classifyAbility,
    aggregateAbilityBonuses,
    effectiveAttributes,
    eventDomains,
    scoreAbilityForEvent,
    attributeScaleLabel,
  };
})();
