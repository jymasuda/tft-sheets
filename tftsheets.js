import { LobcorpHunter } from "./templates/actor/tftLobCorpSheet.js";
import {
  inputCreate,
  paleDamage,
  sinPointsRender,
  updateRpEntry,
  RP_TYPES,
} from "./scripts/scripts.js";

// ---------------------------------------------------------------------------
// Sheet registration
// ---------------------------------------------------------------------------
Hooks.once("init", function () {
  foundry.documents.collections.Actors.registerSheet("vtm5e", LobcorpHunter, {
    types: ["hunter"],
    makeDefault: true,
    label: "TFT Lob Corp Sheet",
  });
});

Hooks.once("ready", function () {});

// ---------------------------------------------------------------------------
// Resistance select options
// ---------------------------------------------------------------------------
const RESIST_OPTIONS = {
  Fatal:   "Fatal",
  Weak:    "Weak",
  Normal:  "Normal",
  Endured: "Endured",
  Immune:  "Immune",
};

// ---------------------------------------------------------------------------
// Attempt to trigger a WoD5E attribute roll via every known API surface.
// Called both from the render hook listener AND from the sheet action.
// ---------------------------------------------------------------------------
async function triggerAttributeRoll(app, attributeKey) {
  const actor = app.document;

  // ── Method 1: WoD5E v5 system API ────────────────────────────────────────
  const api = game.system?.api ?? game.wod5e;
  if (api?.Rolls?.handleRoll) {
    try {
      await api.Rolls.handleRoll({ actor, attribute: attributeKey, rollType: "attribute" });
      return;
    } catch(e) { console.warn("[TFT] api.Rolls.handleRoll failed:", e); }
  }

  // ── Method 2: WoD5E RollHandler ───────────────────────────────────────────
  if (api?.RollHandler?.rollAttribute) {
    try {
      await api.RollHandler.rollAttribute(actor, attributeKey);
      return;
    } catch(e) { console.warn("[TFT] RollHandler.rollAttribute failed:", e); }
  }

  // ── Method 3: Dispatch a synthetic click on the WoD5E system-rollable
  //    element if the system's own sheet is open alongside ours ─────────────
  // (Not applicable for our custom sheet — skip)

  // ── Method 4: Direct WoD5E roll function from its module scope ───────────
  if (game.wod5e?.rolls?.rollAttribute) {
    try {
      await game.wod5e.rolls.rollAttribute({ actor, attribute: attributeKey });
      return;
    } catch(e) { console.warn("[TFT] game.wod5e.rolls.rollAttribute failed:", e); }
  }

  // ── Method 5: Fallback — open the standard Foundry roll dialog ────────────
  const attrValue = foundry.utils.getProperty(actor, `system.attributes.${attributeKey}.value`)
                 ?? foundry.utils.getProperty(actor, `system.${attributeKey}.value`)
                 ?? 0;
  const label = attributeKey.charAt(0).toUpperCase() + attributeKey.slice(1);
  const roll = new Roll(`${attrValue}dh`); // Hunter dice
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Rolling ${label} (${attrValue} dice)`,
    rollMode: game.settings.get("core", "rollMode"),
  });
}

// ---------------------------------------------------------------------------
// Main render hook
// ---------------------------------------------------------------------------
Hooks.on("renderLobcorpHunter", (app, html, context, options) => {
  const scope = "tft-sheets";

  // ── Agent panel ──────────────────────────────────────────────────────────
  inputCreate(app, options, "base", "blurbFlag", "???",
    html.querySelector(".blurb-input"),
    html.querySelector(".blurb-field")
  );
  inputCreate(app, options, "base", "sinFlag", "WRATH",
    html.querySelector(".sin-input"),
    html.querySelector(".sin-field"),
    { WRATH:"WRATH", LUST:"LUST", SLOTH:"SLOTH", GLUTTONY:"GLUTTONY",
      GLOOM:"GLOOM", PRIDE:"PRIDE", ENVY:"ENVY" }
  );

  paleDamage(app, html.getElementsByClassName("resource-counter-step"));
  sinPointsRender(app, html);

  // ── Armor title (guarded) ─────────────────────────────────────────────────
  const armorTitleInput   = html.querySelector(".armor-title-input");
  const armorTitleDisplay = html.querySelector(".armor-title-display");
  if (armorTitleInput || armorTitleDisplay) {
    inputCreate(app, options, "base", "armorTitle", "",
      armorTitleInput,
      armorTitleDisplay
    );
  }

  // ── Physical resistance dropdowns ─────────────────────────────────────────
  for (let n = 1; n <= 3; n++) {
    inputCreate(app, options, "base", `resist${n}`, "Normal",
      html.querySelector(`.resist-input-${n}`),
      html.querySelector(`.resist-display-${n}`),
      RESIST_OPTIONS
    );
  }

  // ── Colour damage resistance dropdowns ───────────────────────────────────
  for (const color of ["red", "white", "black", "pale"]) {
    const cap = color.charAt(0).toUpperCase() + color.slice(1);
    inputCreate(app, options, "base", `resist${cap}`, "Normal",
      html.querySelector(`.resist-input-${color}`),
      html.querySelector(`.resist-display-${color}`),
      RESIST_OPTIONS
    );
  }

  // ── Changeable icons ──────────────────────────────────────────────────────
  html.querySelectorAll(".dmg-type-icon.clickable, .stat-cat-icon.clickable").forEach(img => {
    img.addEventListener("click", () => {
      const iconFlag = img.dataset.iconFlag;
      if (!iconFlag) return;
      new FilePicker({
        type:     "image",
        current:  app.document.getFlag(scope, iconFlag) ?? "",
        callback: async (path) => {
          await app.document.setFlag(scope, iconFlag, path);
        },
      }).browse();
    });
  });

  // ── Attribute rolls — system-rollable spans ───────────────────────────────
  // Belt-and-suspenders: also wire clicks directly here in case data-action
  // dispatch doesn't reach our handler (e.g. ApplicationV2 action bubbling).
  html.querySelectorAll(".system-rollable[data-attribute]").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const attributeKey = el.dataset.attribute;
      if (!attributeKey) return;
      await triggerAttributeRoll(app, attributeKey);
    });
  });

  // ── Justice attribute rolls ───────────────────────────────────────────────
  html.querySelectorAll(".justice-rollable[data-attribute]").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const attributeKey = el.dataset.attribute;
      if (!attributeKey) return;
      await triggerAttributeRoll(app, attributeKey);
    });
  });

  // ── RP entries — type selects ─────────────────────────────────────────────
  html.querySelectorAll(".rp-type-select").forEach(sel => {
    sel.value = sel.dataset.currentType ?? "Passive";
    sel.addEventListener("change", async () => {
      const id      = sel.dataset.entryId;
      const newType = sel.value;
      if (newType === "Core Passive") {
        const entries = app.document.getFlag(scope, "rpEntries") ?? [];
        const hasCore = entries.some(e => e.id !== id && e.type === "Core Passive");
        if (hasCore) {
          ui.notifications.warn("Only one Core Passive is allowed.");
          sel.value = sel.dataset.currentType ?? "Passive";
          return;
        }
      }
      sel.dataset.currentType = newType;
      await updateRpEntry(app, id, { type: newType });
    });
  });

  // ── RP entries — name inputs ──────────────────────────────────────────────
  html.querySelectorAll(".rp-name-field").forEach(input => {
    input.addEventListener("change", async () => {
      await updateRpEntry(app, input.dataset.entryId, { name: input.value });
    });
  });

  // ── RP entries — description textareas ───────────────────────────────────
  html.querySelectorAll(".rp-desc-textarea").forEach(ta => {
    ta.addEventListener("change", async () => {
      await updateRpEntry(app, ta.dataset.entryId, { desc: ta.value });
    });
  });

  // ── RP entries — delete buttons ───────────────────────────────────────────
  html.querySelectorAll(".rp-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id      = btn.dataset.entryId;
      const entries = (app.document.getFlag(scope, "rpEntries") ?? [])
        .filter(e => e.id !== id);
      await app.document.setFlag(scope, "rpEntries", entries);
    });
  });

  // ── RP entries — add button ───────────────────────────────────────────────
  html.querySelector(".rp-add-btn")?.addEventListener("click", async () => {
    const entries = foundry.utils.duplicate(
      app.document.getFlag(scope, "rpEntries") ?? []
    );
    entries.push({
      id:   foundry.utils.randomID(),
      type: "Passive",
      name: "",
      desc: "",
    });
    await app.document.setFlag(scope, "rpEntries", entries);
  });

  // ── Skill specialty inputs ────────────────────────────────────────────────
  html.querySelectorAll(".skill-spec-input").forEach(input => {
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {}, 600);
    });
  });

  // ── Justice attribute — name inputs ───────────────────────────────────────
  html.querySelectorAll(".justice-name-input").forEach(input => {
    input.addEventListener("change", async () => {
      const flagKey = input.dataset.nameFlag;
      if (!flagKey) return;
      await app.document.setFlag(scope, flagKey, input.value);
    });
  });

  // ── Justice attribute — dot clicks ────────────────────────────────────────
  html.querySelectorAll(".justice-dot").forEach(dot => {
    dot.addEventListener("click", async () => {
      const valFlag = dot.dataset.valFlag;
      const idx     = Number(dot.dataset.dotIndex);
      if (!valFlag) return;
      const current = Number(app.document.getFlag(scope, valFlag) ?? 0);
      const newVal  = current === idx ? idx - 1 : idx;
      await app.document.setFlag(scope, valFlag, newVal);
    });
  });
});