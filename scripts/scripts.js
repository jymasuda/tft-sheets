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
  const sinMax = doc.getFlag(scope, "sinMax") ?? 10;

  // Tint the sin-points section to match the chosen sin colour
  const sinFlag = doc.getFlag(scope, "sinFlag") ?? "WRATH";
  const sinColors = {
    WRATH: "#da4c33", LUST: "#f0a33f", SLOTH: "#fcd700",
    GLUTTONY: "#b3d42f", GLOOM: "#56b4c9", PRIDE: "#2887cf", ENVY: "#9c69b2",
  };
  const sinSection = html.querySelector(".sin-points-container");
  if (sinSection) {
    sinSection.style.setProperty("--sin-active-color", sinColors[sinFlag] ?? "#a3a075");
  }

  // Render pip squares
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


  // Allow clicking a pip to set the value directly
  tracker.querySelectorAll(".sin-pip").forEach((pip, idx) => {
    pip.addEventListener("click", async () => {
      const cur = doc.getFlag(scope, "sinCurrent") ?? 0;
      // Toggle: clicking the last active pip removes it
      const newVal = cur === idx + 1 ? idx : idx + 1;
      await doc.setFlag(scope, "sinCurrent", newVal);
    });
  });

};

// ---------------------------------------------------------------------------
// prepareBaseContext — enriches sheet context with all data needed by HBS
// ---------------------------------------------------------------------------
export const prepareBaseContext = async function (context, actor) {
  const actorData = actor.system;
  const scope = "tft-sheets";

  // Tab pointer (required by parent sheet layout)
  context.tab = context.tabs?.stats;

  // ── Raw system data ────────────────────────────────────────────────────
  context.sortedAttributes = actorData.sortedAttributes;
  context.sortedSkills     = actorData.sortedSkills;
  context.customRolls      = actorData.customRolls;
  context.conditions       = actorData.conditions;

  // ── Processed attributes with Roman-numeral rating ────────────────────
  // rating = number of attributes in the group at value ≥ 3
  if (actorData.sortedAttributes) {
    context.processedAttributes = {};
    for (const [gKey, group] of Object.entries(actorData.sortedAttributes)) {
      const attrs = group.attributes || {};
      const entries = Object.entries(attrs).map(([k, v]) => ({ key: k, ...v }));
      const rating = entries.filter(a => (a.value ?? 0) >= 3).length;
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

  // ── Combat skills (hunter powers / edges) ─────────────────────────────
  // Adjust the type filter if your WoD5e build uses a different item type.
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

  // ── Right panel flag values ───────────────────────────────────────────
  const f = (key, def = "") => actor.getFlag(scope, key) ?? def;
  context.egoGiftName      = f("egoGiftName");
  context.egoGiftDesc      = f("egoGiftDesc");
  context.allyPassiveName  = f("allyPassiveName");
  context.allyPassiveDesc  = f("allyPassiveDesc");
  context.repFlawName      = f("repFlawName");
  context.repFlawDesc      = f("repFlawDesc");
  context.allyFlawName     = f("allyFlawName");
  context.allyFlawDesc     = f("allyFlawDesc");

  // Resistance ratings (Fatal / Weak / Normal / Endured / Immune)
  context.resist1 = f("resist1", "Normal");
  context.resist2 = f("resist2", "Normal");
  context.resist3 = f("resist3", "Normal");
  context.resist4 = f("resist4", "Normal");

  // Sin points
  context.sinCurrent = actor.getFlag(scope, "sinCurrent") ?? 0;
  context.sinMax     = actor.getFlag(scope, "sinMax")     ?? 10;

  // Colour damage resistance ratings
  context.resistRed   = f("resistRed",   "Normal");
  context.resistWhite = f("resistWhite", "Normal");
  context.resistBlack = f("resistBlack", "Normal");
  context.resistPale  = f("resistPale",  "Normal");

  // Colour damage icon paths (empty = fallback SVG in HBS)
  context.iconRed   = f("iconRed",   "");
  context.iconWhite = f("iconWhite", "");
  context.iconBlack = f("iconBlack", "");
  context.iconPale  = f("iconPale",  "");
  return context;
};
