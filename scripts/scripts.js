// ---------------------------------------------------------------------------
// Utility: Roman numeral converter
// ---------------------------------------------------------------------------
const toRoman = (num) => {
  if (!num || num <= 0) return "–";
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
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
// inputCreate — text / select input injected into unlocked/locked targets
// ---------------------------------------------------------------------------
export const inputCreate = async function (
  app,
  options,
  part,
  key,
  defaultValue,
  unlockTarget,
  lockTarget,
  selectOptions
) {
  if (options.parts && !options.parts.includes(part)) return;
  const doc = app.document;
  const scope = "tft-sheets";
  const value = doc.getFlag(scope, key) ?? defaultValue;
  const name = `flags.${scope}.${key}`;

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
// paleDamage — right-click to toggle pale/aggravated state on resource steps
// ---------------------------------------------------------------------------
export const paleDamage = async function (app, targets) {
  const doc = app.document;
  const docData = foundry.utils.duplicate(doc);
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const resource = target.id;
    if (!resource || !docData.system[resource]) continue;
    target.oncontextmenu = function () {
      if (!docData.system[resource].pale) docData.system[resource].pale = 0;
      if (!target.dataset.state && !target.classList.contains("pale")) {
        docData.system[resource].max = Math.max(docData.system[resource].max - 1, 0);
        docData.system[resource].pale++;
      } else if (target.classList.contains("pale")) {
        docData.system[resource].max++;
        docData.system[resource].pale = Math.max(docData.system[resource].pale - 1, 0);
      }
      doc.update(docData);
    };
  }
};

// ---------------------------------------------------------------------------
// sinPointsRender — draws sin pip squares and binds +/- buttons
// ---------------------------------------------------------------------------
export const sinPointsRender = async function (app, html) {
  const doc = app.document;
  const scope = "tft-sheets";
  const sinCurrent = doc.getFlag(scope, "sinCurrent") ?? 0;
  const sinMax     = doc.getFlag(scope, "sinMax")     ?? 10;

  const sinFlag = doc.getFlag(scope, "sinFlag") ?? "WRATH";
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
      const cur = doc.getFlag(scope, "sinCurrent") ?? 0;
      const newVal = cur === idx + 1 ? idx : idx + 1;
      await doc.setFlag(scope, "sinCurrent", newVal);
    });
  });
};

// ---------------------------------------------------------------------------
// updateRpEntry — patch one entry inside the rpEntries flag array
// ---------------------------------------------------------------------------
export const updateRpEntry = async function (app, id, changes) {
  const scope   = "tft-sheets";
  const entries = foundry.utils.duplicate(
    app.document.getFlag(scope, "rpEntries") ?? []
  );
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  Object.assign(entry, changes);
  await app.document.setFlag(scope, "rpEntries", entries);
};

// ---------------------------------------------------------------------------
// prepareBaseContext — enriches sheet context with all data needed by HBS
// ---------------------------------------------------------------------------
export const prepareBaseContext = async function (context, actor) {
  const actorData = actor.system;
  const scope = "tft-sheets";

  context.tab = context.tabs?.stats;

  // ── Raw system data ────────────────────────────────────────────────────
  context.sortedAttributes = actorData.sortedAttributes;
  context.sortedSkills     = actorData.sortedSkills;
  context.customRolls      = actorData.customRolls;
  context.conditions       = actorData.conditions;

  // ── Processed attributes (kept for backward compat) ───────────────────
  if (actorData.sortedAttributes) {
    context.processedAttributes = {};
    for (const [gKey, group] of Object.entries(actorData.sortedAttributes)) {
      const attrs   = group.attributes || {};
      const entries = Object.entries(attrs).map(([k, v]) => ({ key: k, ...v }));
      const rating  = entries.filter(a => (a.value ?? 0) >= 3).length;
      context.processedAttributes[gKey] = {
        label:       group.label,
        attributes:  attrs,
        rating,
        romanRating: toRoman(rating),
      };
    }
  }

  // ── Processed skills ──────────────────────────────────────────────────
  if (actorData.sortedSkills) {
    context.processedSkills = {};
    for (const [gKey, group] of Object.entries(actorData.sortedSkills)) {
      context.processedSkills[gKey] = {
        label:  group.label,
        skills: group.skills || {},
      };
    }
  }

  // ── Combat skills ─────────────────────────────────────────────────────
  context.combatSkills = actor.items
    .filter(i => i.type === "power" || i.type === "edge")
    .map((item, idx) => ({
      id:          item.id,
      name:        item.name,
      img:         item.img,
      index:       idx + 1,
      summary:     item.system?.summary     ?? "",
      description: item.system?.description ?? "",
      _id:         item._id,
    }));

  // ── RP entries (dynamic array) ────────────────────────────────────────
  context.rpEntries = actor.getFlag(scope, "rpEntries") ?? [];
  context.rpTypes   = RP_TYPES;

  // ── Resistance ratings ────────────────────────────────────────────────
  const f = (key, def = "") => actor.getFlag(scope, key) ?? def;
  context.resist1 = f("resist1", "Normal");
  context.resist2 = f("resist2", "Normal");
  context.resist3 = f("resist3", "Normal");
  context.resist4 = f("resist4", "Normal");

  context.resistRed   = f("resistRed",   "Normal");
  context.resistWhite = f("resistWhite", "Normal");
  context.resistBlack = f("resistBlack", "Normal");
  context.resistPale  = f("resistPale",  "Normal");

  // ── Damage-type icon paths ────────────────────────────────────────────
  context.iconSlash  = f("iconSlash",  "https://limbuscompany.wiki.gg/images/Slash.png?f764b5&format=original");
  context.iconPierce = f("iconPierce", "https://limbuscompany.wiki.gg/images/Pierce.png?1111a2&format=original");
  context.iconBlunt  = f("iconBlunt",  "https://limbuscompany.wiki.gg/images/Blunt.png?4f33d9&format=original");
  context.iconRed    = f("iconRed",    "https://lobotomycorporation.wiki.gg/images/RedDamageTypeIcon.png?1750fd");
  context.iconWhite  = f("iconWhite",  "https://lobotomycorporation.wiki.gg/images/WhiteDamageTypeIcon.png?1ab1e5");
  context.iconBlack  = f("iconBlack",  "https://lobotomycorporation.wiki.gg/images/BlackDamageTypeIcon.png?6b5770");
  context.iconPale   = f("iconPale",   "https://lobotomycorporation.wiki.gg/images/PaleDamageTypeIcon.png?63725d");

  // ── Armor title ───────────────────────────────────────────────────────
  context.armorTitle = f("armorTitle", "");

  // ── Sin points ────────────────────────────────────────────────────────
  context.sinCurrent = actor.getFlag(scope, "sinCurrent") ?? 0;
  context.sinMax     = actor.getFlag(scope, "sinMax")     ?? 10;

  // ── Lock state ─────────────────────────────────────────────────────────
  context.locked = actor.getFlag(scope, "sheetLocked") ?? false;

  // ── Stat Groups (Fortitude / Prudence / Temperance / Justice) ─────────
  //
  // Each group object:
  //   key         — DOM identifier / data-group value
  //   label       — display name shown as the title
  //   color       — accent colour (hex string)
  //   iconFlag    — flag key that stores the user-chosen icon path
  //   iconSrc     — resolved flag value (empty = use defaultIcon)
  //   defaultIcon — fallback Foundry icon if none assigned yet
  //   attributes  — array of { key, displayName, value, isSystem }
  //   rating      — count of attrs at value ≥ 3
  //   romanRating — Roman-numeral string for rating
  //   isSystem    — true = uses WoD5E editAttribute action; false = flag-based

  const buildSystemGroup = (srcKey, label, limit, color, iconFlag, defaultIcon) => {
    const group = actorData.sortedAttributes?.[srcKey];
    if (!group) return null;
    const attrs = group.attributes || {};
    const entries = Object.entries(attrs)
      .map(([k, v]) => ({
        key:         k,
        displayName: v.displayName ?? k,
        value:       v.value ?? 0,
        isSystem:    true,
      }))
      .slice(0, limit);
    const rating = entries.filter(a => a.value >= 3).length;
    return {
      key:         srcKey,
      label,
      color,
      iconFlag,
      iconSrc:     f(iconFlag, ""),
      defaultIcon,
      attributes:  entries,
      rating,
      romanRating: toRoman(rating),
      isSystem:    true,
    };
  };

  // Justice — two fully custom attributes stored as flags
  const j1name  = f("justiceAttr1Name", "Attribute 1");
  const j2name  = f("justiceAttr2Name", "Attribute 2");
  const j1val   = Number(actor.getFlag(scope, "justiceAttr1Val") ?? 0);
  const j2val   = Number(actor.getFlag(scope, "justiceAttr2Val") ?? 0);
  const jEntry1 = { key: "justiceAttr1", displayName: j1name, value: j1val, isSystem: false };
  const jEntry2 = { key: "justiceAttr2", displayName: j2name, value: j2val, isSystem: false };
  const jEntries = [jEntry1, jEntry2];
  const jRating  = jEntries.filter(a => a.value >= 3).length;

  const justiceGroup = {
    key:         "justice",
    label:       "Justice",
    color:       "#56b4c9",
    iconFlag:    "iconJustice",
    iconSrc:     f("iconJustice", ""),
    defaultIcon: "https://lobotomycorporation.wiki.gg/images/JusticeIcon.png?ab29a4",
    attributes:  jEntries,
    rating:      jRating,
    romanRating: toRoman(jRating),
    isSystem:    false,
  };

  // Display order: Fortitude (top-left), Prudence (top-right),
  //                Temperance (bottom-left), Justice (bottom-right)
  context.statGroups = [
    buildSystemGroup("physical", "Fortitude",  2, "#da4c33", "iconFortitude",  "https://lobotomycorporation.wiki.gg/images/FortitudeIcon.png?9dcd99"),
    buildSystemGroup("mental",   "Prudence",   2, "#e8e8d8", "iconPrudence",   "https://lobotomycorporation.wiki.gg/images/PrudenceIcon.png?f10fb2"),
    buildSystemGroup("social",   "Temperance", 3, "#9c69b2", "iconTemperance", "https://lobotomycorporation.wiki.gg/images/TemperanceIcon.png?b942c9"),
    justiceGroup,
  ].filter(Boolean);

  return context;
};