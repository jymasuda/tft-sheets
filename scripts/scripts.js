// ---------------------------------------------------------------------------
// Utility: Roman numeral converter
// ---------------------------------------------------------------------------
const toRoman = (num) => {
  if (!num || num <= 0) return "–";
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","EX","IV","I"];
  let r = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { r += syms[i]; num -= vals[i]; }
  }
  return r;
};

// ---------------------------------------------------------------------------
// All valid RP entry types and their display labels
// ---------------------------------------------------------------------------
export const RP_TYPES = [
  { value: "Core Passive",       label: "Core Passive",       maxOne: true  },
  { value: "EGO Gift",           label: "EGO Gift",           maxOne: false },
  { value: "Passive",            label: "Passive",            maxOne: false },
  { value: "Flaw",               label: "Flaw",               maxOne: false },
  { value: "Reputation Passive", label: "Reputation Passive", maxOne: false },
  { value: "Reputation Flaw",    label: "Reputation Flaw",    maxOne: false },
  { value: "Ally Passive",       label: "Ally Passive",       maxOne: false },
  { value: "Ally Flaw",          label: "Ally Flaw",          maxOne: false },
  { value: "EGO Resonance",      label: "EGO Resonance",      maxOne: false },
  { value: "Resonance",          label: "Resonance",          maxOne: false },
];

// ---------------------------------------------------------------------------
// Combat skill type options
// ---------------------------------------------------------------------------
export const COMBAT_SKILL_TYPES = [
  { value: "attack",    label: "Attack (default)" },
  { value: "defense",   label: "Defense"          },
  { value: "corrosion", label: "Corrosion Skill"  },
  { value: "panic",     label: "Panic"            },
];

const SKILL_TYPE_LABELS = {
  attack:    "",
  defense:   "Defense",
  corrosion: "Corrosion Skill",
  panic:     "Panic",
};

// ---------------------------------------------------------------------------
// inputCreate
// ---------------------------------------------------------------------------
export const inputCreate = async function (
  app, options, part, key, defaultValue, unlockTarget, lockTarget, selectOptions
) {
  if (options.parts && !options.parts.includes(part)) return;
  const doc   = app.document;
  const scope = "tft-sheets";
  const value = doc.getFlag(scope, key) ?? defaultValue;
  const name  = `flags.${scope}.${key}`;

  if (unlockTarget == null) {
    lockTarget.insertAdjacentText("afterbegin", value);
    if (key === "sinFlag") lockTarget.classList.add(value);
    return;
  }

  if (selectOptions !== undefined) {
    const arrayOptions = Object.entries(selectOptions).map(([v, l]) => ({ value: v, label: l }));
    const input = foundry.applications.fields.createSelectInput({ name, value, options: arrayOptions });
    unlockTarget.insertAdjacentElement("afterbegin", input);
  } else {
    const input = foundry.applications.fields.createTextInput({ name, value });
    unlockTarget.insertAdjacentElement("afterbegin", input);
  }
};

// ---------------------------------------------------------------------------
// paleDamage — right-click health pips to toggle a faded "pale damage" look.
// ---------------------------------------------------------------------------
const PALE_STYLE = {
  backgroundColor: "rgba(255, 77, 77, 0.30)",
  borderColor:     "rgba(255, 77, 77, 0.50)",
  boxShadow:       "0 0 4px rgba(255, 77, 77, 0.20)",
  outline:         "none",
};

const clearPaleStyle = (step) => {
  step.style.removeProperty("background-color");
  step.style.removeProperty("border-color");
  step.style.removeProperty("box-shadow");
  step.style.removeProperty("outline");
};

const applyPaleStyle = (step) => {
  Object.assign(step.style, PALE_STYLE);
};

export const paleDamage = function (app, html) {
  const doc   = app.document;
  const scope = "tft-sheets";

  const applyDisabledPips = () => {
    const disabled     = new Set(doc.getFlag(scope, "disabledPips") ?? []);
    const healthCounter = html.querySelector(".resource-counter[data-name='system.health']");
    if (!healthCounter) return;

    healthCounter.querySelectorAll(".resource-counter-step").forEach(step => {
      const pipKey = `health-${step.dataset.index ?? ""}`;
      if (disabled.has(pipKey)) {
        applyPaleStyle(step);
        step.classList.add("tft-pale-disabled");
      } else {
        clearPaleStyle(step);
        step.classList.remove("tft-pale-disabled");
      }
    });
  };

  applyDisabledPips();

  const healthCounter = html.querySelector(".resource-counter[data-name='system.health']");
  if (!healthCounter) return;

  healthCounter.querySelectorAll(".resource-counter-step").forEach(step => {
    step.addEventListener("click", (e) => {
      if (!step.classList.contains("tft-pale-disabled")) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);

    step.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const index      = step.dataset.index ?? "";
      const pipKey     = `health-${index}`;
      const current    = foundry.utils.duplicate(doc.getFlag(scope, "disabledPips") ?? []);
      const existingIdx = current.indexOf(pipKey);

      if (existingIdx === -1) {
        current.push(pipKey);
        applyPaleStyle(step);
        step.classList.add("tft-pale-disabled");
      } else {
        current.splice(existingIdx, 1);
        clearPaleStyle(step);
        step.classList.remove("tft-pale-disabled");
      }

      await doc.setFlag(scope, "disabledPips", current);
    }, true);
  });
};

// ---------------------------------------------------------------------------
// sinPointsRender
// ---------------------------------------------------------------------------
export const sinPointsRender = async function (app, html) {
  const doc    = app.document;
  const scope  = "tft-sheets";
  const sinCurrent = doc.getFlag(scope, "sinCurrent") ?? 0;
  const sinMax     = doc.getFlag(scope, "sinMax")     ?? 10;
  const sinFlag    = doc.getFlag(scope, "sinFlag")    ?? "WRATH";

  const sinColors = {
    WRATH: "#da4c33", LUST: "#f0a33f", SLOTH: "#fcd700",
    GLUTTONY: "#b3d42f", GLOOM: "#56b4c9", PRIDE: "#2887cf", ENVY: "#9c69b2",
  };
  const sinSection = html.querySelector(".sin-points-container");
  if (sinSection) {
    sinSection.style.setProperty("--sin-active-color", sinColors[sinFlag] ?? "#a3a075");
  }

  const tracker = html.querySelector(".sin-pip-track");
  if (!tracker) return;
  tracker.innerHTML = "";
  for (let i = 0; i < sinMax; i++) {
    const pip = document.createElement("span");
    pip.classList.add("sin-pip");
    if (i < sinCurrent) pip.classList.add("active");
    pip.title = `Sin ${i + 1}`;
    tracker.appendChild(pip);
  }

  tracker.querySelectorAll(".sin-pip").forEach((pip, idx) => {
    pip.addEventListener("click", async () => {
      const cur    = doc.getFlag(scope, "sinCurrent") ?? 0;
      const newVal = cur === idx + 1 ? idx : idx + 1;
      await doc.setFlag(scope, "sinCurrent", newVal);
    });
  });
};

// ---------------------------------------------------------------------------
// updateRpEntry
// ---------------------------------------------------------------------------
export const updateRpEntry = async function (app, id, changes) {
  const scope   = "tft-sheets";
  const entries = foundry.utils.duplicate(app.document.getFlag(scope, "rpEntries") ?? []);
  const entry   = entries.find(e => e.id === id);
  if (!entry) return;
  Object.assign(entry, changes);
  await app.document.setFlag(scope, "rpEntries", entries);
};

// ---------------------------------------------------------------------------
// prepareBaseContext
// ---------------------------------------------------------------------------
export const prepareBaseContext = async function (context, actor) {
  const actorData = actor.system;
  const scope     = "tft-sheets";

  context.tab = context.tabs?.stats;

  context.sortedAttributes = actorData.sortedAttributes;
  context.sortedSkills     = actorData.sortedSkills;
  context.hasSpecialties   = Object.values(actorData.sortedSkills ?? {})
    .flatMap(group => Object.values(group))
    .some(s => s?.bonuses?.length > 0);
  context.customRolls = actorData.customRolls;
  context.conditions  = actorData.conditions;

  if (actorData.sortedAttributes) {
    context.processedAttributes = {};
    for (const [gKey, group] of Object.entries(actorData.sortedAttributes)) {
      const attrs   = group.attributes || {};
      const entries = Object.entries(attrs).map(([k, v]) => ({ key: k, ...v }));
      const rating  = entries.filter(a => (a.value ?? 0) >= 3).length;
      context.processedAttributes[gKey] = {
        label: group.label, attributes: attrs, rating, romanRating: toRoman(rating),
      };
    }
  }

  if (actorData.sortedSkills) {
    context.processedSkills = {};
    for (const [gKey, group] of Object.entries(actorData.sortedSkills)) {
      context.processedSkills[gKey] = { label: group.label, skills: group.skills || {} };
    }
  }

  let attackIndex = 0;
  context.combatSkills = actor.items
    .filter(i => i.type === "customRoll")
    .map((item) => {
      const skillType = item.getFlag(scope, "skillType") ?? "attack";
      const isAttack  = skillType === "attack";
      if (isAttack) attackIndex++;
      const rawDesc = item.system?.description
        ?? item.system?.action?.toChat?.content
        ?? item.system?.details?.description ?? "";
      const description = rawDesc.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim();
      return {
        id: item.id, name: item.name, img: item.img,
        index: isAttack ? attackIndex : null,
        uuid: item.uuid, _id: item._id, description, skillType,
        skillTypeLabel: SKILL_TYPE_LABELS[skillType] ?? "",
      };
    });

  context.combatSkillTypes = COMBAT_SKILL_TYPES;
  context.rpEntries        = actor.getFlag(scope, "rpEntries") ?? [];
  context.rpTypes          = RP_TYPES;

  const f = (key, def = "") => actor.getFlag(scope, key) ?? def;
  context.resist1     = f("resist1",     "Normal");
  context.resist2     = f("resist2",     "Normal");
  context.resist3     = f("resist3",     "Normal");
  context.resist4     = f("resist4",     "Normal");
  context.resistRed   = f("resistRed",   "Normal");
  context.resistWhite = f("resistWhite", "Normal");
  context.resistBlack = f("resistBlack", "Normal");
  context.resistPale  = f("resistPale",  "Normal");

  context.iconSlash  = f("iconSlash",  "https://limbuscompany.wiki.gg/images/Slash.png?f764b5&format=original");
  context.iconPierce = f("iconPierce", "https://limbuscompany.wiki.gg/images/Pierce.png?1111a2&format=original");
  context.iconBlunt  = f("iconBlunt",  "https://limbuscompany.wiki.gg/images/Blunt.png?4f33d9&format=original");
  context.iconRed    = f("iconRed",    "https://lobotomycorporation.wiki.gg/images/RedDamageTypeIcon.png?1750fd");
  context.iconWhite  = f("iconWhite",  "https://lobotomycorporation.wiki.gg/images/WhiteDamageTypeIcon.png?1ab1e5");
  context.iconBlack  = f("iconBlack",  "https://lobotomycorporation.wiki.gg/images/BlackDamageTypeIcon.png?6b5770");
  context.iconPale   = f("iconPale",   "https://lobotomycorporation.wiki.gg/images/PaleDamageTypeIcon.png?63725d");

  context.armorTitle = f("armorTitle", "");
  context.armorImage = f("armorImage", ""); // ← NEW: changeable armor portrait
  context.sinCurrent = actor.getFlag(scope, "sinCurrent") ?? 0;
  context.sinMax     = actor.getFlag(scope, "sinMax")     ?? 10;
  context.locked     = actor.getFlag(scope, "sheetLocked") ?? false;

  const buildSystemGroup = (srcKey, indices, label, color, iconFlag, defaultIcon) => {
    const group = actorData.sortedAttributes?.[srcKey];
    if (!group) return null;
    const rawAttrs   = group.attributes ?? group;
    const allEntries = Object.entries(rawAttrs)
      .filter(([k]) => k !== "label")
      .map(([k, v]) => ({
        key: k, id: v.id ?? k,
        displayName: v.displayName ?? v.label ?? k,
        value: Number(v.value ?? 0), isSystem: true,
      }));
    const entries = indices.map(i => allEntries[i]).filter(Boolean);
    const rating  = entries.reduce((max, a) => Math.max(max, a.value), 0);
    return {
      key: srcKey, label, color, iconFlag,
      iconSrc: f(iconFlag, ""), defaultIcon,
      attributes: entries, rating, romanRating: toRoman(rating), isSystem: true,
    };
  };

  const buildHybridEntry = (srcKey, idx) => {
    const group = actorData.sortedAttributes?.[srcKey];
    if (!group) return null;
    const rawAttrs = group.attributes ?? group;
    const entries  = Object.entries(rawAttrs)
      .filter(([k]) => k !== "label")
      .map(([k, v]) => ({
        key: k, id: v.id ?? k,
        displayName: v.displayName ?? v.label ?? k,
        value: Number(v.value ?? 0), isSystem: true,
      }));
    return entries[idx] ?? null;
  };

  const jEntries = [
    buildHybridEntry("physical", 2),
    buildHybridEntry("mental",   2),
  ].filter(Boolean);
  const jRating = jEntries.reduce((max, a) => Math.max(max, a.value), 0);

  context.statGroups = [
    buildSystemGroup("physical", [0,1],   "Fortitude",  "red",    "iconFortitude",  "https://lobotomycorporation.wiki.gg/images/FortitudeIcon.png?9dcd99"),
    buildSystemGroup("mental",   [0,1],   "Prudence",   "white",  "iconPrudence",   "https://lobotomycorporation.wiki.gg/images/PrudenceIcon.png?f10fb2"),
    buildSystemGroup("social",   [0,1,2], "Temperance", "purple", "iconTemperance", "https://lobotomycorporation.wiki.gg/images/TemperanceIcon.png?b942c9"),
    {
      key: "justice", label: "Justice", color: "cyan",
      iconFlag: "iconJustice", iconSrc: f("iconJustice", ""),
      defaultIcon: "https://lobotomycorporation.wiki.gg/images/JusticeIcon.png?ab29a4",
      attributes: jEntries, rating: jRating, romanRating: toRoman(jRating), isSystem: true,
    },
  ].filter(Boolean);

  return context;
};