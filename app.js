(function () {
  "use strict";

  const DATA = window.BLEACH_DATA;
  const SAVE_KEY = "bleach-life-simulator-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const raceOptions = {
    human: { label: "普通人 / 高灵感人类", sigil: "人", spirit: 18, role: "普通学生" },
    soul: { label: "普通魂魄", sigil: "魂", spirit: 26, role: "流魂街居民" },
    shinigami: { label: "死神方向", sigil: "死", spirit: 48, role: "真央灵术院学生" },
    hollow: { label: "虚 / 破面方向", sigil: "虚", spirit: 58, role: "游荡之虚" },
    quincy: { label: "灭却师血统", sigil: "滅", spirit: 44, role: "未受训灭却师" },
    fullbringer: { label: "完现术潜质", sigil: "現", spirit: 38, role: "灵能力者" },
  };

  const realms = {
    human: { label: "现世 · 空座町", mark: "現", danger: 15 },
    soul: { label: "尸魂界 · 流魂街", mark: "魂", danger: 24 },
    seireitei: { label: "尸魂界 · 瀞灵廷", mark: "廷", danger: 19 },
    hueco: { label: "虚圈", mark: "虚", danger: 61 },
    wandenreich: { label: "见えざる帝国", mark: "滅", danger: 48 },
  };

  const backgrounds = {
    human: ["普通学生", "打工者", "医院家庭", "商店家庭", "无业调查者"],
    soul: ["流魂街居民", "小店帮工", "治安队成员", "孤儿群体", "灵术院考生"],
    seireitei: ["真央灵术院学生", "普通队士", "下级贵族旁支", "技术开发局见习", "四番队医护见习"],
    hueco: ["游荡之虚", "群落猎手", "低阶破面从属", "避战型虚", "领地守卫"],
    wandenreich: ["见习圣兵", "后勤人员", "隐匿观察者", "普通居民", "灵子工匠"],
  };

  const eraConfig = {
    substitute: { label: "死神代行篇前夕", year: 2001, month: 4, pressure: 12 },
    "soul-society": { label: "尸魂界篇", year: 2001, month: 8, pressure: 34 },
    arrancar: { label: "破面篇", year: 2002, month: 5, pressure: 52 },
    fullbring: { label: "完现术篇", year: 2003, month: 3, pressure: 27 },
    tybw: { label: "千年血战篇", year: 2003, month: 6, pressure: 88 },
  };

  const actionDefinitions = [
    { id: "daily", name: "工作 / 学习", desc: "维持社会身份，获得收入、知识和日常关系。", cost: 1, mark: "常" },
    { id: "growth", name: "能力训练", desc: "推进技能与力量，但疲劳会影响训练质量。", cost: 1, mark: "鍛" },
    { id: "exploration", name: "探索当前地点", desc: "寻找新路线、情报、灵异痕迹或意外相遇。", cost: 1, mark: "探" },
    { id: "relationship", name: "主动社交", desc: "与认识的人见面；对方仍会按自己的日程与目标行动。", cost: 1, mark: "縁" },
    { id: "choice", name: "追查机会", desc: "接触可能改变人生方向的矛盾、请求与抉择。", cost: 2, mark: "選" },
    { id: "accident", name: "承担危险任务", desc: "高风险事件更容易带来伤势、名声和组织关注。", cost: 2, mark: "危" },
    { id: "rest", name: "休息与恢复", desc: "降低疲劳并处理轻伤。结果通常确定，不进行检定。", cost: 1, mark: "静" },
    { id: "month", name: "结束本月", desc: "结算收入、伤势、NPC计划、组织行动与世界事件。", cost: 0, mark: "月" },
  ];

  const mapNodes = [
    { id: "human", label: "现世 · 空座町", desc: "现代社会与隐藏灵异层叠加的重灵地。", access: "open", cost: 1, mark: "現" },
    { id: "soul", label: "尸魂界 · 流魂街", desc: "由众多区域构成的魂魄聚居地，生活条件差异极大。", access: "spirit", cost: 2, mark: "魂" },
    { id: "seireitei", label: "尸魂界 · 瀞灵廷", desc: "护廷十三队与尸魂界核心机构所在地，需要合法权限。", access: "shinigami", cost: 2, mark: "廷" },
    { id: "hueco", label: "虚圈 · 白色沙漠", desc: "高灵子环境与虚的生存领地，常规路线极其危险。", access: "advanced", cost: 3, mark: "虚" },
    { id: "wandenreich", label: "见えざる帝国", desc: "隐藏于影中的灭却师领域，位置与入口不会对外公开。", access: "quincy", cost: 3, mark: "滅" },
    { id: "dangai", label: "断界", desc: "连接不同世界的夹层通道，不是可随意停留的普通地点。", access: "route", cost: 2, mark: "断" },
    { id: "royal", label: "灵王宫", desc: "高权限封闭区域。知道其存在不等于拥有到达方式。", access: "locked", cost: 4, mark: "王" },
    { id: "hell", label: "地狱", desc: "只显示模糊传闻；当前人生没有可验证的稳定路线。", access: "locked", cost: 4, mark: "獄" },
  ];

  let state = null;
  let creationMode = "free";
  let pendingEvent = null;
  let pendingResolution = null;
  let selectedNpc = null;
  let abilityPageSize = 20;
  let toastTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    for (const item of items) {
      cursor -= item.weight;
      if (cursor <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  function uid(prefix = "evt") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function fillCreatorOptions() {
    const raceSelect = $("#race-select");
    raceSelect.innerHTML = Object.entries(raceOptions)
      .map(([id, item]) => `<option value="${id}">${escapeHtml(item.label)}</option>`)
      .join("");
    updateBackgroundOptions();
    $("#database-badges").innerHTML = [
      `${DATA.meta.eventCount} 个事件节点`,
      `${DATA.meta.socialEventCount} 个社交事件`,
      `${DATA.meta.npcCount} 个角色模板`,
      `${DATA.meta.abilityCount} 条能力资料`,
    ].map((text) => `<span>${text}</span>`).join("");
  }

  function updateBackgroundOptions() {
    const realm = $("#realm-select").value;
    $("#background-select").innerHTML = backgrounds[realm]
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("");
  }

  function setCreationMode(mode) {
    creationMode = mode;
    $$(".mode-card").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    $$(".free-field").forEach((field) => field.classList.toggle("hidden", mode === "random"));
    $("#random-preview").classList.toggle("hidden", mode !== "random");
  }

  function randomCharacter() {
    const era = weightedPick([
      { value: "substitute", weight: 42 },
      { value: "soul-society", weight: 22 },
      { value: "arrancar", weight: 17 },
      { value: "fullbring", weight: 12 },
      { value: "tybw", weight: 7 },
    ]);
    const realm = weightedPick([
      { value: "human", weight: 54 },
      { value: "soul", weight: 31 },
      { value: "seireitei", weight: 9 },
      { value: "hueco", weight: 5 },
      { value: "wandenreich", weight: 1 },
    ]);
    const pools = {
      human: [
        { value: "human", weight: 81 },
        { value: "fullbringer", weight: 7 },
        { value: "quincy", weight: 4 },
        { value: "shinigami", weight: 3 },
        { value: "soul", weight: 5 },
      ],
      soul: [
        { value: "soul", weight: 83 },
        { value: "shinigami", weight: 15 },
        { value: "hollow", weight: 2 },
      ],
      seireitei: [
        { value: "shinigami", weight: 74 },
        { value: "soul", weight: 24 },
        { value: "fullbringer", weight: 2 },
      ],
      hueco: [
        { value: "hollow", weight: 96 },
        { value: "soul", weight: 4 },
      ],
      wandenreich: [
        { value: "quincy", weight: 92 },
        { value: "human", weight: 8 },
      ],
    };
    const race = weightedPick(pools[realm]);
    return { era, realm, race, background: randomItem(backgrounds[realm]) };
  }

  function initialKnownNpcs(realm, era) {
    const groups = {
      human: ["黑崎一护", "井上织姬", "石田雨龙", "茶渡泰虎", "浦原喜助", "朽木露琪亚"],
      soul: ["阿散井恋次", "朽木露琪亚", "志波岩鹫", "浮竹十四郎", "京乐春水", "卯之花烈"],
      seireitei: ["阿散井恋次", "朽木白哉", "京乐春水", "伊势七绪", "日番谷冬狮郎", "更木剑八"],
      hueco: ["葛力姆乔", "妮莉艾露", "乌尔奇奥拉", "赫丽贝尔"],
      wandenreich: ["尤格兰·哈斯沃德", "巴兹比", "友哈巴赫", "石田雨龙"],
    };
    let names = groups[realm] || groups.human;
    if (era === "substitute") names = names.filter((name) => !["乌尔奇奥拉", "赫丽贝尔"].includes(name));
    const available = new Set(DATA.npcs.map((npc) => npc.name));
    return names.filter((name) => available.has(name));
  }

  function createInitialState(options) {
    const era = eraConfig[options.era];
    const race = raceOptions[options.race];
    const knownNpcs = initialKnownNpcs(options.realm, options.era);
    const relations = {};
    knownNpcs.forEach((name, index) => {
      relations[name] = {
        familiarity: index < 2 ? 18 : 6,
        trust: index < 2 ? 4 : 0,
        respect: 0,
        tension: 0,
      };
    });
    return {
      version: 1,
      id: uid("life"),
      name: options.name || "无名旅者",
      mode: options.mode,
      canon: options.canon,
      tone: options.tone,
      era: options.era,
      year: era.year,
      month: era.month,
      elapsedMonths: 0,
      realm: options.realm,
      location: options.realm,
      race: options.race,
      background: options.background,
      role: options.background || race.role,
      ap: 10,
      maxAp: 10,
      health: 100,
      fatigue: 8,
      spirit: race.spirit,
      reputation: 0,
      money: options.realm === "human" ? 8000 : 120,
      stats: {
        body: 38 + Math.floor(Math.random() * 17),
        mind: 38 + Math.floor(Math.random() * 17),
        perception: 35 + Math.floor(Math.random() * 20),
        will: 38 + Math.floor(Math.random() * 18),
        social: 34 + Math.floor(Math.random() * 20),
        control: 25 + Math.floor(Math.random() * 20),
      },
      skills: { life: 1, training: 0, combat: 0, research: 0, social: 0 },
      knownNpcs,
      relations,
      discoveredLocations: [...new Set([options.realm, "human"])],
      abilities: [],
      flags: {},
      worldPressure: era.pressure,
      history: [],
      causalQueue: [
        { title: "你自己的生活", detail: "维持当前身份与本月义务", months: 1 },
        { title: "陌生灵压", detail: "附近的灵异活动正在缓慢变化", months: 2 },
      ],
      opportunities: [],
      recentEventIds: [],
      eventLocks: {},
    };
  }

  function startLife() {
    let options;
    if (creationMode === "random") {
      options = randomCharacter();
    } else {
      options = {
        era: $("#era-select").value,
        realm: $("#realm-select").value,
        race: $("#race-select").value,
        background: $("#background-select").value,
      };
    }
    Object.assign(options, {
      name: $("#name-input").value.trim() || "无名旅者",
      mode: creationMode,
      canon: $("#canon-select").value,
      tone: $("#tone-select").value,
    });
    state = createInitialState(options);
    addHistory("人生开始", `${raceOptions[state.race].label} · ${realms[state.realm].label} · ${state.role}`, "system");
    generateOpportunities();
    enterGame();
    saveGame(false);
    if (creationMode === "random") {
      showToast(`级联随机完成：${realms[state.realm].label} / ${raceOptions[state.race].label}`);
    }
  }

  function enterGame() {
    $("#creator-screen").classList.add("hidden");
    $("#game-screen").classList.remove("hidden");
    renderAll();
  }

  function stateDate() {
    return `${state.year}年${state.month}月`;
  }

  function phaseLabel() {
    const base = eraConfig[state.era].label;
    if (state.elapsedMonths < 4) return base;
    if (state.elapsedMonths < 9) return `${base} · 局势演化`;
    return `${base} · 改变后的世界线`;
  }

  function spiritLabel(value) {
    if (value < 20) return "微弱";
    if (value < 35) return "略有感知";
    if (value < 50) return "清晰可见";
    if (value < 70) return "活跃";
    if (value < 90) return "强大";
    return "异常庞大";
  }

  function fatigueLabel(value) {
    if (value < 18) return "精力充足";
    if (value < 42) return "轻微疲劳";
    if (value < 70) return "明显疲劳";
    return "接近极限";
  }

  function healthLabel(value) {
    if (value >= 90) return "正常";
    if (value >= 70) return "轻伤";
    if (value >= 40) return "中度受伤";
    if (value > 0) return "重伤";
    return "失去行动能力";
  }

  function reputationLabel(value) {
    if (value < 5) return "无人知晓";
    if (value < 18) return "小有名气";
    if (value < 40) return "受到关注";
    if (value < 70) return "重要人物";
    return "改变世界者";
  }

  function pressureLabel(value) {
    if (value < 25) return "平静";
    if (value < 45) return "暗流";
    if (value < 65) return "紧张";
    if (value < 85) return "战争边缘";
    return "世界危机";
  }

  function renderAll() {
    renderHud();
    renderActions();
    renderOpportunities();
    renderTimeline();
    renderCausalQueue();
    renderMap();
    renderSocial();
    prepareAbilityFilters();
    renderAbilities();
    renderHistory();
  }

  function renderHud() {
    $("#hud-date").textContent = stateDate();
    $("#hud-phase").textContent = phaseLabel();
    $("#hud-location").textContent = realms[state.location]?.label || state.location;
    $("#player-name").textContent = state.name;
    $("#player-origin").textContent = raceOptions[state.race].label;
    $("#player-role").textContent = state.role;
    $("#avatar-sigil").textContent = raceOptions[state.race].sigil;
    $("#ap-value").textContent = `${state.ap} / ${state.maxAp}`;
    $("#ap-pips").innerHTML = Array.from({ length: state.maxAp }, (_, index) => `<i class="${index < state.ap ? "on" : ""}"></i>`).join("");
    $("#status-health").textContent = healthLabel(state.health);
    $("#status-fatigue").textContent = fatigueLabel(state.fatigue);
    $("#status-spirit").textContent = spiritLabel(state.spirit);
    $("#status-reputation").textContent = reputationLabel(state.reputation);
    $("#status-money").textContent = state.realm === "human" ? `¥ ${state.money.toLocaleString()}` : `${state.money.toLocaleString()} 环`;
    $("#pressure-value").textContent = state.worldPressure;
    $("#pressure-label").textContent = pressureLabel(state.worldPressure);
    $("#world-headline").textContent = worldHeadline();
    $("#world-summary").textContent = `${realms[state.location]?.label || state.location} · ${state.role}。世界中的人物和组织正在继续自己的计划。`;
  }

  function worldHeadline() {
    const realmHeadlines = {
      human: ["风穿过空座町，普通生活的缝隙里藏着灵压。", "街道仍然忙碌，但少数人看见了不该看见的东西。"],
      soul: ["流魂街迎来新月，远处的瀞灵廷依旧沉默。", "生活继续，灵力与秩序却在悄悄改变。"],
      seireitei: ["队舍的钟声响起，新的命令正在层层传达。", "瀞灵廷表面有序，职责与秘密各自运行。"],
      hueco: ["白色沙漠没有昼夜，只有远近不定的灵压。", "虚夜宫的阴影之外，捕食与避战同样真实。"],
      wandenreich: ["影之领域保持安静，命令比情感更先抵达。", "灵子在影中聚集，没人能假装看不见战争。"],
    };
    const list = realmHeadlines[state.location] || realmHeadlines.human;
    return list[state.elapsedMonths % list.length];
  }

  function renderActions() {
    $("#action-grid").innerHTML = actionDefinitions.map((action) => {
      const disabled = (pendingEvent && action.id !== "month") || (action.cost > state.ap && action.id !== "month");
      return `
        <button class="action-card" data-action="${action.id}" data-mark="${action.mark}" ${disabled ? "disabled" : ""} type="button">
          <span class="action-cost">${action.cost ? `${action.cost} AP` : "结算"}</span>
          <strong>${action.name}</strong>
          <small>${action.desc}</small>
        </button>`;
    }).join("");
  }

  function relevantEvent(event) {
    const haystack = `${event.id} ${event.scope} ${event.trigger}`;
    const raceTokens = {
      human: ["所有", "现世", "人类", "普通", "社交", "学生", "职业"],
      soul: ["所有", "尸魂界", "魂魄", "流魂街", "社交"],
      shinigami: ["所有", "死神", "学院", "尸魂界", "斩魄刀", "社交"],
      hollow: ["所有", "虚", "破面", "虚圈", "社交"],
      quincy: ["所有", "灭却师", "现世", "见えざる帝国", "社交"],
      fullbringer: ["所有", "完现术", "人类", "现世", "社交"],
    };
    return raceTokens[state.race].some((token) => haystack.includes(token)) || Math.random() < 0.16;
  }

  function pickEvent(category) {
    let candidates = DATA.events.filter((event) => event.category === category && relevantEvent(event));
    const fresh = candidates.filter((event) => !state.recentEventIds.includes(event.id));
    if (fresh.length) candidates = fresh;
    if (!candidates.length) candidates = DATA.events.filter((event) => event.category === category);
    return randomItem(candidates);
  }

  function beginAction(actionId) {
    const action = actionDefinitions.find((item) => item.id === actionId);
    if (!action) return;
    if (actionId === "month") {
      advanceMonth();
      return;
    }
    if (state.ap < action.cost) {
      showToast("本月行动点不足。你可以结束本月进行结算。");
      return;
    }
    if (actionId === "rest") {
      state.ap -= action.cost;
      const recovered = Math.min(state.fatigue, 24);
      state.fatigue = clamp(state.fatigue - 24, 0, 100);
      state.health = clamp(state.health + 8, 0, 100);
      addHistory("休息与恢复", `疲劳降低 ${recovered}，身体状态有所恢复。`, "daily");
      saveGame(false);
      renderAll();
      showToast("这是确定性结果：无需掷骰。");
      return;
    }
    pendingEvent = { ...pickEvent(actionId), actionCost: action.cost, actionId };
    renderActiveEvent();
    renderActions();
    $("#active-event").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderActiveEvent() {
    const container = $("#active-event");
    if (!pendingEvent) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }
    const choices = pendingEvent.choices.length ? pendingEvent.choices : ["继续"];
    container.innerHTML = `
      <span class="event-id">${escapeHtml(pendingEvent.id)} · ${escapeHtml(pendingEvent.category.toUpperCase())}</span>
      <h2>${escapeHtml(pendingEvent.name)}</h2>
      <p><b>触发：</b>${escapeHtml(pendingEvent.trigger)}<br><b>可能影响：</b>${escapeHtml(pendingEvent.outcome)}</p>
      <div class="event-choices">
        ${choices.map((choice, index) => `<button data-event-choice="${index}" type="button">${escapeHtml(choice)}</button>`).join("")}
        <button data-cancel-event type="button">暂不行动</button>
      </div>`;
    container.classList.remove("hidden");
  }

  function statModifier(value) {
    if (value < 20) return -4;
    if (value < 35) return -2;
    if (value < 50) return 0;
    if (value < 65) return 1;
    if (value < 80) return 3;
    if (value < 95) return 5;
    return 7;
  }

  function buildCheck(event, choice, context = {}) {
    const categoryStats = {
      daily: ["mind", "social"],
      growth: ["will", "control"],
      exploration: ["perception", "mind"],
      relationship: ["social", "perception"],
      choice: ["will", "mind"],
      accident: ["body", "perception"],
      series: ["will", "control"],
      world: ["will", "body"],
      social: ["social", "perception"],
    };
    const keys = categoryStats[event.category] || categoryStats.daily;
    let modifier = statModifier(state.stats[keys[0]]) + statModifier(state.stats[keys[1]]);
    const factors = [
      `${keys[0]} ${modifier >= 0 ? "+" : ""}${statModifier(state.stats[keys[0]])}`,
      `${keys[1]} ${statModifier(state.stats[keys[1]]) >= 0 ? "+" : ""}${statModifier(state.stats[keys[1]])}`,
    ];
    const skillKey = event.category === "growth" ? "training" : event.category === "accident" ? "combat" : event.category === "social" || event.category === "relationship" ? "social" : "life";
    const skillBonus = Math.min(5, state.skills[skillKey] || 0);
    modifier += skillBonus;
    factors.push(`熟练 +${skillBonus}`);
    if (state.fatigue >= 65) {
      modifier -= 3;
      factors.push("严重疲劳 -3");
    } else if (state.fatigue >= 40) {
      modifier -= 1;
      factors.push("疲劳 -1");
    }
    if (state.health < 70) {
      modifier -= 2;
      factors.push("伤势 -2");
    }
    if (context.npc) {
      const relation = state.relations[context.npc] || { trust: 0, respect: 0, tension: 0 };
      const relationBonus = Math.floor((relation.trust + relation.respect - relation.tension) / 30);
      modifier += relationBonus;
      factors.push(`关系 ${relationBonus >= 0 ? "+" : ""}${relationBonus}`);
    }
    const categoryDc = { daily: 10, growth: 14, exploration: 13, relationship: 12, choice: 15, accident: 17, series: 18, world: 20, social: 13 };
    let dc = categoryDc[event.category] || 13;
    dc += Math.floor(state.worldPressure / 30);
    if (/卍解|完圣体|灵王|队长|死亡|战争/.test(`${event.name}${event.trigger}`)) dc += 4;
    if (/基础|普通|日常|小事/.test(`${event.name}${event.trigger}`)) dc -= 2;
    const lockKey = `${state.year}-${state.month}-${event.id}-${choice}-${context.npc || ""}`;
    const locked = state.eventLocks[lockKey];
    const roll = locked?.roll || 1 + Math.floor(Math.random() * 20);
    return { modifier, dc: clamp(dc, 5, 30), factors, roll, lockKey, context };
  }

  function classifyResult(total, dc, roll) {
    const margin = total - dc;
    if (roll === 20 && margin >= 0) return { id: "critical", label: "关键成功", tone: "命运给了你一个额外窗口。" };
    if (roll === 1 && margin < 0) return { id: "disaster", label: "重大失败", tone: "问题没有停止在这一步，新的后果正在形成。" };
    if (margin >= 10) return { id: "critical", label: "卓越成功", tone: "你不只达成目标，还获得了额外收益。" };
    if (margin >= 5) return { id: "strong", label: "强成功", tone: "事情比预期完成得更好。" };
    if (margin >= 0) return { id: "success", label: "成功", tone: "你完成了主要目标。" };
    if (margin >= -4) return { id: "cost", label: "带代价的结果", tone: "你得到了一部分，但必须承担代价。" };
    if (margin >= -9) return { id: "failure", label: "失败", tone: "目标没有完成，局势留下了新的问题。" };
    return { id: "disaster", label: "严重失败", tone: "后果扩大，你必须在以后处理它。" };
  }

  function openResolution(event, choice, context = {}) {
    const check = buildCheck(event, choice, context);
    pendingResolution = { event, choice, check, revealed: false };
    $("#resolution-title").textContent = event.name;
    $("#roll-value").textContent = "?";
    $("#modifier-value").textContent = `${check.modifier >= 0 ? "+" : ""}${check.modifier}`;
    $("#dc-value").textContent = check.dc;
    $("#check-factors").innerHTML = check.factors.map((factor) => `<span>${escapeHtml(factor)}</span>`).join("");
    $("#resolved-outcome").classList.add("hidden");
    $("#resolved-outcome").innerHTML = "";
    $("#reveal-result").classList.remove("hidden");
    $("#reveal-result").disabled = false;
    $("#wheel-core").textContent = "?";
    $("#result-wheel").classList.add("spinning");
    $("#resolution-modal").classList.remove("hidden");
  }

  function revealResolution() {
    if (!pendingResolution || pendingResolution.revealed) return;
    pendingResolution.revealed = true;
    const { event, choice, check } = pendingResolution;
    const total = check.roll + check.modifier;
    const result = classifyResult(total, check.dc, check.roll);
    state.eventLocks[check.lockKey] = { roll: check.roll, result: result.id };
    $("#reveal-result").disabled = true;
    setTimeout(() => {
      $("#result-wheel").classList.remove("spinning");
      $("#wheel-core").textContent = check.roll;
      $("#roll-value").textContent = check.roll;
      $("#resolved-outcome").innerHTML = `<strong>${escapeHtml(result.label)}</strong><span>${escapeHtml(result.tone)} ${escapeHtml(event.outcome || "")}</span>`;
      $("#resolved-outcome").classList.remove("hidden");
      $("#reveal-result").classList.add("hidden");
      applyResolution(event, choice, result, check);
    }, 700);
  }

  function applyResolution(event, choice, result, check) {
    const successScale = { critical: 4, strong: 3, success: 2, cost: 1, failure: -1, disaster: -3 }[result.id];
    if (pendingEvent) {
      state.ap = clamp(state.ap - pendingEvent.actionCost, 0, state.maxAp);
      state.fatigue = clamp(state.fatigue + (pendingEvent.actionCost * 7), 0, 100);
      const skillKey = event.category === "growth" ? "training" : event.category === "accident" ? "combat" : event.category === "relationship" ? "social" : "life";
      state.skills[skillKey] = clamp((state.skills[skillKey] || 0) + (successScale > 0 ? 1 : 0), 0, 8);
    } else if (check.context.npc) {
      state.ap = clamp(state.ap - 1, 0, state.maxAp);
      state.fatigue = clamp(state.fatigue + 4, 0, 100);
    }
    if (event.category === "growth" && successScale > 0) {
      state.spirit = clamp(state.spirit + successScale, 0, 120);
      state.stats.control = clamp(state.stats.control + successScale, 0, 110);
      maybeUnlockAbility();
    }
    if (event.category === "exploration" && successScale > 0) discoverSomething();
    if (["accident", "world"].includes(event.category) && successScale < 0) {
      state.health = clamp(state.health + successScale * 4, 0, 100);
    }
    if (["choice", "accident", "world"].includes(event.category)) {
      state.reputation = clamp(state.reputation + Math.max(0, successScale), 0, 100);
    }
    if (check.context.npc) updateRelation(check.context.npc, result.id, choice);
    state.recentEventIds.unshift(event.id);
    state.recentEventIds = state.recentEventIds.slice(0, 24);
    addHistory(event.name, `选择「${choice}」— ${result.label}。${event.outcome || result.tone}`, event.category);
    if (result.id === "disaster" || result.id === "cost") {
      state.causalQueue.unshift({ title: `处理：${event.name}`, detail: "未解决的代价会在未来月份继续产生影响", months: result.id === "disaster" ? 3 : 1 });
    }
    pendingEvent = null;
    saveGame(false);
    renderAll();
    renderActiveEvent();
  }

  function maybeUnlockAbility() {
    if (Math.random() > 0.34) return;
    const prefixes = { shinigami: "Z", hollow: "H", quincy: "Q", fullbringer: "F", human: "F", soul: "Z" };
    const prefix = prefixes[state.race];
    const options = DATA.abilities.filter((ability) => ability.id.startsWith(prefix) && !state.abilities.includes(ability.id));
    if (!options.length) return;
    const ability = randomItem(options.slice(0, Math.min(options.length, 24 + state.skills.training * 4)));
    state.abilities.push(ability.id);
    addHistory("能力进展", `你掌握或理解了：${ability.name}（${ability.id}）`, "growth");
    showToast(`能力进展：${ability.name}`);
  }

  function discoverSomething() {
    const locked = mapNodes.filter((node) => !state.discoveredLocations.includes(node.id) && node.access !== "locked");
    if (locked.length && Math.random() < 0.42) {
      const node = randomItem(locked);
      state.discoveredLocations.push(node.id);
      addHistory("获得路线线索", `你知道了「${node.label}」的大致存在与可能路线。`, "exploration");
    }
    const unknownNpcs = DATA.npcs.filter((npc) => !state.knownNpcs.includes(npc.name));
    if (unknownNpcs.length && Math.random() < 0.35) {
      const npc = randomItem(unknownNpcs);
      state.knownNpcs.push(npc.name);
      state.relations[npc.name] = { familiarity: 1, trust: 0, respect: 0, tension: 0 };
      addHistory("听说一名人物", `你第一次得到关于「${npc.name}」的可靠信息。`, "relationship");
    }
  }

  function closeResolution() {
    if (pendingResolution && !pendingResolution.revealed) {
      showToast("结果已经锁定。请先揭晓这次判定。");
      return;
    }
    $("#resolution-modal").classList.add("hidden");
    pendingResolution = null;
  }

  function generateOpportunities() {
    const categories = ["daily", "growth", "exploration", "choice"];
    state.opportunities = categories.map((category) => {
      const event = pickEvent(category);
      return { id: event.id, name: event.name, category, hint: event.trigger };
    });
    if (state.worldPressure > 55) {
      const world = pickEvent("world");
      state.opportunities.unshift({ id: world.id, name: world.name, category: "world", hint: "世界事件的消息正在接近你" });
    }
    state.opportunities = state.opportunities.slice(0, 4);
  }

  function renderOpportunities() {
    $("#opportunity-list").innerHTML = state.opportunities.map((item) => `
      <div class="opportunity">
        <i></i>
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.hint)}</small></div>
        <b>${escapeHtml(item.category.toUpperCase())}</b>
      </div>`).join("");
  }

  function advanceMonth() {
    if (pendingEvent) {
      showToast("请先处理或放弃当前事件。");
      return;
    }
    const unused = state.ap;
    state.month += 1;
    if (state.month > 12) {
      state.month = 1;
      state.year += 1;
    }
    state.elapsedMonths += 1;
    state.ap = state.maxAp;
    state.money += state.realm === "human" ? 22000 : 85;
    state.fatigue = clamp(state.fatigue - 28, 0, 100);
    state.health = clamp(state.health + 10, 0, 100);
    const pressureDelta = Math.floor(Math.random() * 13) - 4 + (state.era === "tybw" ? 3 : 0);
    state.worldPressure = clamp(state.worldPressure + pressureDelta, 5, 100);
    state.causalQueue = state.causalQueue
      .map((item) => ({ ...item, months: item.months - 1 }))
      .filter((item) => item.months > 0);
    if (state.elapsedMonths % 3 === 0) {
      const world = pickEvent("world");
      const involvement = Math.floor(state.spirit / 20) + Math.floor(state.reputation / 12) + (state.worldPressure > 60 ? 3 : 0);
      if (involvement >= 7) {
        state.causalQueue.push({ title: world.name, detail: "你的能力、位置或关系使你难以完全置身事外", months: 2 });
        addHistory("世界事件逼近", `${world.name}：你可能被邀请、指派、波及或针对。`, "world");
      } else {
        addHistory("远方传闻", `${world.name}：你目前只听到零散消息，世界没有强迫你成为主角。`, "world");
      }
    }
    updateNpcPlans();
    generateOpportunities();
    addHistory("月末结算", `进入${stateDate()}。未使用 ${unused} AP；收入、恢复与世界行动已结算。`, "system");
    saveGame(false);
    renderAll();
    showToast("新月份开始：10 AP 已恢复。");
  }

  function updateNpcPlans() {
    Object.entries(state.relations).forEach(([name, relation]) => {
      if (relation.familiarity > 0 && Math.random() < 0.16) {
        relation.familiarity = clamp(relation.familiarity - 1, 0, 100);
      }
      if (relation.tension > 0) relation.tension = clamp(relation.tension - 2, 0, 100);
      if (Math.random() < 0.04 + relation.familiarity / 1000) {
        const event = randomItem(DATA.socialEvents);
        state.causalQueue.push({ title: `${name}：${event.name}`, detail: "NPC根据自己的日程与关系主动产生了一个低频互动机会", months: 1 });
      }
    });
  }

  function addHistory(title, detail, type) {
    state.history.unshift({ id: uid("log"), date: stateDate(), title, detail, type, at: Date.now() });
    state.history = state.history.slice(0, 240);
  }

  function renderTimeline() {
    const recent = state.history.slice(0, 12);
    $("#timeline-log").innerHTML = recent.length ? recent.map((item) => `
      <article class="log-entry">
        <time>${escapeHtml(item.date)}</time>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </article>`).join("") : `<p class="section-note">尚无记录。</p>`;
  }

  function renderCausalQueue() {
    $("#causal-list").innerHTML = state.causalQueue.length ? state.causalQueue.slice(0, 5).map((item) => `
      <div class="causal-item"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} · 约${item.months}个月</small></div>`).join("") : `<p class="section-note">暂时没有明显未结因果。</p>`;
  }

  function canAccessNode(node) {
    if (node.id === state.location) return { ok: false, reason: "当前地点" };
    if (!state.discoveredLocations.includes(node.id)) return { ok: false, reason: "路线未知" };
    if (node.access === "locked") return { ok: false, reason: "没有可行路线" };
    if (node.access === "spirit" && state.spirit < 24) return { ok: false, reason: "无法稳定离体/穿界" };
    if (node.access === "shinigami" && !["shinigami", "soul"].includes(state.race) && state.reputation < 25) return { ok: false, reason: "缺少瀞灵廷权限" };
    if (node.access === "quincy" && state.race !== "quincy") return { ok: false, reason: "入口与身份不符" };
    if (node.access === "advanced" && state.spirit < 55) return { ok: false, reason: "生存能力不足" };
    if (node.access === "route" && state.spirit < 35) return { ok: false, reason: "缺少穿界交通" };
    if (state.ap < node.cost) return { ok: false, reason: "AP不足" };
    return { ok: true, reason: `${node.cost} AP` };
  }

  function renderMap() {
    $("#map-grid").innerHTML = mapNodes.map((node) => {
      const access = canAccessNode(node);
      const discovered = state.discoveredLocations.includes(node.id);
      return `
        <article class="map-node ${node.id === state.location ? "current" : ""} ${!discovered ? "locked" : ""}" data-mark="${node.mark}">
          <span class="event-id">${discovered ? "已知地点" : "未知区域"}</span>
          <h3>${discovered ? escapeHtml(node.label) : "???"}</h3>
          <p>${discovered ? escapeHtml(node.desc) : "你还没有获得可靠情报，系统不会公开后台地图。"}</p>
          <div class="map-meta"><span>${access.reason}</span><span>危险 ${realms[node.id]?.danger ?? "?"}</span></div>
          <button class="travel-button" data-travel="${node.id}" ${access.ok ? "" : "disabled"} type="button">${node.id === state.location ? "你在这里" : access.ok ? "规划路线并前往" : access.reason}</button>
        </article>`;
    }).join("");
  }

  function travelTo(nodeId) {
    const node = mapNodes.find((item) => item.id === nodeId);
    const access = canAccessNode(node);
    if (!access.ok) return showToast(access.reason);
    state.ap -= node.cost;
    state.location = node.id;
    state.fatigue = clamp(state.fatigue + node.cost * 8, 0, 100);
    addHistory("跨区域旅行", `你抵达了${node.label}。`, "exploration");
    generateOpportunities();
    saveGame(false);
    renderAll();
    showToast(`已抵达：${node.label}`);
  }

  function relationLabel(relation) {
    if (relation.tension >= 70) return "敌对";
    if (relation.trust >= 70 && relation.familiarity >= 70) return "深度信任";
    if (relation.familiarity >= 60) return "熟悉";
    if (relation.familiarity >= 30) return "认识";
    if (relation.familiarity >= 15) return "见过";
    return "陌生";
  }

  function renderSocial() {
    const npcs = state.knownNpcs.map((name) => DATA.npcs.find((npc) => npc.name === name)).filter(Boolean);
    $("#npc-list").innerHTML = npcs.map((npc) => {
      const relation = state.relations[npc.name];
      return `<button class="${selectedNpc === npc.name ? "active" : ""}" data-npc="${escapeHtml(npc.name)}" type="button">
        <span class="npc-monogram">${escapeHtml(npc.name.slice(0, 1))}</span>
        <span><strong>${escapeHtml(npc.name)}</strong><small>${escapeHtml(relationLabel(relation))}</small></span>
      </button>`;
    }).join("");
    if (selectedNpc && state.relations[selectedNpc]) renderNpcDetail(selectedNpc);
  }

  function renderNpcDetail(name) {
    const npc = DATA.npcs.find((item) => item.name === name);
    const relation = state.relations[name];
    if (!npc || !relation) return;
    const bar = (label, value, range = 100) => {
      const normalized = range === 200 ? (value + 100) / 2 : value;
      return `<label><span>${label}</span><i style="--value:${clamp(normalized, 0, 100)}%"></i><b>${value}</b></label>`;
    };
    $("#npc-detail").className = "npc-detail";
    $("#npc-detail").innerHTML = `
      <header class="npc-detail-header">
        <div><span class="event-id">CHARACTER SOCIAL PROFILE</span><h2>${escapeHtml(npc.name)}</h2><small>${escapeHtml(npc.tags.join(" · "))}</small></div>
        <span class="relation-label">${escapeHtml(relationLabel(relation))}</span>
      </header>
      <div class="relation-bars">
        ${bar("熟悉", relation.familiarity)}
        ${bar("信任", relation.trust, 200)}
        ${bar("尊重", relation.respect, 200)}
        ${bar("紧张", relation.tension)}
      </div>
      <div class="npc-traits">${npc.likes.slice(0, 5).map((item) => `<span>易接受：${escapeHtml(item)}</span>`).join("")}</div>
      <div class="npc-special">${escapeHtml(npc.special)}</div>
      <div class="social-actions">
        <button data-social-action="打招呼" type="button">打招呼 · 0 AP</button>
        <button data-social-action="聊天" type="button">聊天 · 1 AP</button>
        <button data-social-action="请教" type="button">请教 · 1 AP</button>
        <button data-social-action="一起训练" type="button">一起训练 · 1 AP</button>
        <button data-social-action="提出请求" type="button">提出请求 · 1 AP</button>
      </div>`;
  }

  function socialInteraction(action) {
    if (!selectedNpc) return;
    const relation = state.relations[selectedNpc];
    if (action === "打招呼") {
      relation.familiarity = clamp(relation.familiarity + 1, 0, 100);
      addHistory(`与${selectedNpc}打招呼`, "一次简短接触。对方没有因此立刻信任你。", "relationship");
      saveGame(false);
      renderAll();
      return;
    }
    if (state.ap < 1) return showToast("本月行动点不足。");
    let pool = DATA.socialEvents;
    if (action === "请教" || action === "一起训练") pool = pool.filter((event) => /请教|训练|指导|研究|任务/.test(event.name + event.trigger));
    if (action === "提出请求") pool = pool.filter((event) => /请求|邀请|拒绝|危险|秘密/.test(event.name + event.trigger));
    if (!pool.length) pool = DATA.socialEvents;
    const social = randomItem(pool);
    const event = { ...social, category: "social", outcome: social.outcome };
    openResolution(event, action, { npc: selectedNpc });
  }

  function updateRelation(name, resultId, choice) {
    const relation = state.relations[name];
    const delta = { critical: 8, strong: 5, success: 3, cost: 1, failure: -2, disaster: -6 }[resultId];
    relation.familiarity = clamp(relation.familiarity + Math.max(1, Math.abs(delta)), 0, 100);
    relation.trust = clamp(relation.trust + delta, -100, 100);
    relation.respect = clamp(relation.respect + (resultId === "critical" || resultId === "strong" ? 3 : resultId === "disaster" ? -3 : 0), -100, 100);
    if (resultId === "failure" || resultId === "disaster") relation.tension = clamp(relation.tension + Math.abs(delta) * 2, 0, 100);
    if (/道歉|接受|不追问|保持距离/.test(choice)) relation.tension = clamp(relation.tension - 4, 0, 100);
  }

  function prepareAbilityFilters() {
    const systemSelect = $("#ability-system-filter");
    if (systemSelect.options.length === 1) {
      const systems = [...new Set(DATA.abilities.map((item) => item.sheet))];
      systemSelect.insertAdjacentHTML("beforeend", systems.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value.replace(/^\d+_/, ""))}</option>`).join(""));
    }
    const canonSelect = $("#ability-canon-filter");
    if (canonSelect.options.length === 1) {
      const canons = [...new Set(DATA.abilities.map((item) => item.canon).filter(Boolean))];
      canonSelect.insertAdjacentHTML("beforeend", canons.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));
    }
  }

  function filteredAbilities() {
    const query = $("#ability-search").value.trim().toLowerCase();
    const system = $("#ability-system-filter").value;
    const canon = $("#ability-canon-filter").value;
    return DATA.abilities.filter((ability) => {
      if (system !== "all" && ability.sheet !== system) return false;
      if (canon !== "all" && ability.canon !== canon) return false;
      if (!query) return true;
      return `${ability.id} ${ability.name} ${ability.mechanism} ${ability.effect} ${ability.note}`.toLowerCase().includes(query);
    });
  }

  function renderAbilities() {
    if (!state) return;
    const matches = filteredAbilities();
    $("#ability-results").innerHTML = matches.slice(0, abilityPageSize).map((ability) => `
      <article class="ability-card">
        <header><span class="ability-id">${escapeHtml(ability.id)} · ${escapeHtml(ability.sheet.replace(/^\d+_/, ""))}</span><span class="canon-tag">${escapeHtml(ability.canon || "未标注")}</span></header>
        <h3>${escapeHtml(ability.name)}</h3>
        <p>${escapeHtml(ability.mechanism || ability.effect || "暂无机制说明")}</p>
        ${ability.effect ? `<p><b>表现：</b>${escapeHtml(ability.effect)}</p>` : ""}
        <footer>${escapeHtml(ability.note)}</footer>
      </article>`).join("");
    $("#ability-more").classList.toggle("hidden", matches.length <= abilityPageSize);
    $("#ability-more").textContent = `显示更多（${Math.min(abilityPageSize, matches.length)} / ${matches.length}）`;
  }

  function renderHistory() {
    $("#full-history").innerHTML = state.history.length ? state.history.map((item) => `
      <article class="history-entry">
        <time>${escapeHtml(item.date)} · ${escapeHtml(item.type)}</time>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.detail)}</p>
      </article>`).join("") : `<p>人生尚未开始。</p>`;
  }

  function switchView(view) {
    $$("#main-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
    if (view === "abilities") renderAbilities();
    if (view === "history") renderHistory();
  }

  function saveGame(notify = true) {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (notify) showToast("人生状态已保存到当前浏览器。");
    updateContinueButton();
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved?.id) throw new Error("invalid");
      state = saved;
      state.eventLocks ||= {};
      state.opportunities ||= [];
      state.discoveredLocations ||= [state.realm, "human"];
      pendingEvent = null;
      if (!state.opportunities.length) generateOpportunities();
      enterGame();
      showToast("已继续上一次人生。");
    } catch (error) {
      showToast("没有找到可读取的有效存档。");
    }
  }

  function exportGame() {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BLEACH_${state.name}_${state.year}-${String(state.month).padStart(2, "0")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("存档 JSON 已导出。");
  }

  function importGame(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported?.id || !imported?.race || !imported?.history) throw new Error("invalid");
        state = imported;
        saveGame(false);
        enterGame();
        showToast("存档导入成功。");
      } catch (error) {
        showToast("这个文件不是有效的模拟器存档。");
      }
    };
    reader.readAsText(file);
  }

  function resetGame() {
    if (!confirm("确定结束当前人生并返回创建界面吗？浏览器存档会保留，直到你开始新人生。")) return;
    state = null;
    pendingEvent = null;
    pendingResolution = null;
    selectedNpc = null;
    $("#game-screen").classList.add("hidden");
    $("#creator-screen").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateContinueButton();
  }

  function updateContinueButton() {
    const button = $("#continue-button");
    if (button) button.classList.toggle("hidden", !localStorage.getItem(SAVE_KEY));
  }

  function bindEvents() {
    $$(".mode-card").forEach((button) => button.addEventListener("click", () => setCreationMode(button.dataset.mode)));
    $("#realm-select").addEventListener("change", updateBackgroundOptions);
    $("#start-button").addEventListener("click", startLife);
    $("#continue-button")?.addEventListener("click", loadGame);
    $("#import-creator-button")?.addEventListener("click", () => $("#import-input").click());
    $("#main-nav").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (button) switchView(button.dataset.view);
    });
    $("#action-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (button) beginAction(button.dataset.action);
    });
    $("#active-event").addEventListener("click", (event) => {
      const choiceButton = event.target.closest("[data-event-choice]");
      if (choiceButton && pendingEvent) {
        const choice = pendingEvent.choices[Number(choiceButton.dataset.eventChoice)] || "继续";
        openResolution(pendingEvent, choice);
      }
      if (event.target.closest("[data-cancel-event]")) {
        pendingEvent = null;
        renderActiveEvent();
        renderActions();
      }
    });
    $("#reveal-result").addEventListener("click", revealResolution);
    $$('[data-close-modal], .modal-backdrop').forEach((element) => element.addEventListener("click", closeResolution));
    $("#map-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-travel]");
      if (button) travelTo(button.dataset.travel);
    });
    $("#npc-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-npc]");
      if (!button) return;
      selectedNpc = button.dataset.npc;
      renderSocial();
    });
    $("#npc-detail").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-action]");
      if (button) socialInteraction(button.dataset.socialAction);
    });
    ["#ability-search", "#ability-system-filter", "#ability-canon-filter"].forEach((selector) => {
      $(selector).addEventListener(selector === "#ability-search" ? "input" : "change", () => {
        abilityPageSize = 20;
        renderAbilities();
      });
    });
    $("#ability-more").addEventListener("click", () => {
      abilityPageSize += 20;
      renderAbilities();
    });
    $("#save-button").addEventListener("click", () => saveGame(true));
    $("#export-button").addEventListener("click", exportGame);
    $("#reset-button").addEventListener("click", resetGame);
    $("#clear-log").addEventListener("click", () => {
      $("#timeline-log").innerHTML = `<p class="section-note">显示已清空；完整人生记录仍然保留。</p>`;
    });
    $("#import-input").addEventListener("change", (event) => {
      if (event.target.files?.[0]) importGame(event.target.files[0]);
      event.target.value = "";
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !$("#resolution-modal").classList.contains("hidden")) closeResolution();
    });
  }

  function init() {
    fillCreatorOptions();
    setCreationMode("free");
    bindEvents();
    updateContinueButton();
  }

  init();
})();
