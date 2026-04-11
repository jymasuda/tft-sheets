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
// overridePool: pass an explicit dice count (used for flag-based justice attrs
//               whose values are not stored in system.attributes).
// ---------------------------------------------------------------------------
async function triggerAttributeRoll(app, attributeKey, overridePool = null) {
  const actor = app.document;

  // ── Method 1: WoD5E v5 system API ────────────────────────────────────────
  const api = game.system?.api ?? game.wod5e;
  if (api?.Rolls?.handleRoll) {
    try {
      const rollData = {
        actor,
        attribute: attributeKey,
        rollType: "attribute",
      };
      // For custom/justice attributes the system won't find a value; pass it
      // explicitly so the dialog opens with the right dice count.
      if (overridePool !== null) {
        rollData.pool  = overridePool;
        rollData.title = attributeKey; // label in the dialog
      }
      await api.Rolls.handleRoll(rollData);
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

  // ── Method 3: Direct WoD5E roll function from its module scope ───────────
  if (game.wod5e?.rolls?.rollAttribute) {
    try {
      await game.wod5e.rolls.rollAttribute({ actor, attribute: attributeKey });
      return;
    } catch(e) { console.warn("[TFT] game.wod5e.rolls.rollAttribute failed:", e); }
  }

  // ── Method 4: Fallback — open the standard Foundry roll dialog ────────────
  // Resolve pool: prefer override, then look up the system attribute value.
  const attrValue = overridePool
    ?? foundry.utils.getProperty(actor, `system.attributes.${attributeKey}.value`)
    ?? foundry.utils.getProperty(actor, `system.${attributeKey}.value`)
    ?? 0;
  const label = attributeKey.charAt(0).toUpperCase() + attributeKey.slice(1);
  new Dialog({
    title: `Roll ${label}`,
    content: `<p>Dice pool: <strong>${attrValue}</strong></p>`,
    buttons: {
      roll: {
        label: "Roll",
        callback: async () => {
          const roll = new Roll(`${attrValue}d10cs>5`);
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `Rolling ${label} (${attrValue} dice)`,
            rollMode: game.settings.get("core", "rollMode"),
          });
        },
      },
      cancel: { label: "Cancel" },
    },
    default: "roll",
  }).render(true);
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

  // ── Attribute rolls — system attributes ──────────────────────────────────
  // NOTE: system-rollable spans also carry data-action="rollAttribute" which
  // triggers LobcorpHunter.#onRollAttribute through ApplicationV2's action
  // dispatcher. We do NOT add a second click listener here to avoid
  // double-rolling. The action handler in tftLobCorpSheet.js is the sole
  // entry point for system attribute rolls.

  // ── Attribute rolls — justice (flag-based) attributes ────────────────────
  // Justice attrs are NOT in actor.system so WoD5E can't resolve their value
  // automatically. We intercept here, read the pool from flags, and pass it
  // explicitly to triggerAttributeRoll so the dialog opens with the right
  // dice count.
  html.querySelectorAll(".justice-rollable[data-attribute]").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const attributeKey = el.dataset.attribute;
      if (!attributeKey) return;
      // Derive the flag key: "justiceAttr1" → "justiceAttr1Val"
      const valFlag = `${attributeKey}Val`;
      const pool    = Number(app.document.getFlag(scope, valFlag) ?? 0);
      await triggerAttributeRoll(app, attributeKey, pool);
    });
  });

  // ── Unified attribute dot click handler ───────────────────────────────────
  // Handles both system attributes (Fortitude / Prudence / Temperance) and
  // flag-based justice attributes. Active only when the sheet is unlocked
  // (the template adds the attr-dot-click class only then).
  html.querySelectorAll(".attr-dot-click").forEach(dot => {
    dot.style.cursor = "pointer";
    dot.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const dotIndex = Number(dot.dataset.dotIndex); // 1-based (1-5)
      const isSystem = dot.dataset.isSystem === "true";

      if (!isSystem) {
        // ── Justice / flag-based attribute ────────────────────────────────
        const valFlag = dot.dataset.valFlag;
        if (!valFlag) return;
        const current = Number(app.document.getFlag(scope, valFlag) ?? 0);
        // Clicking the already-active top dot decrements by 1 (toggle off).
        const newVal = current === dotIndex ? dotIndex - 1 : dotIndex;
        await app.document.setFlag(scope, valFlag, Math.max(0, newVal));
      } else {
        // ── System attribute (WoD5E actor data) ───────────────────────────
        const key   = dot.dataset.attribute;
        const doc   = app.document;
        const path1 = `system.attributes.${key}.value`;
        const path2 = `system.${key}.value`;

        let current;
        const updateData = {};
        if (foundry.utils.getProperty(doc, path1) !== undefined) {
          current = Number(foundry.utils.getProperty(doc, path1) ?? 0);
          const newVal = current === dotIndex ? dotIndex - 1 : dotIndex;
          updateData[path1] = Math.clamped(newVal, 0, 5);
        } else {
          current = Number(foundry.utils.getProperty(doc, path2) ?? 0);
          const newVal = current === dotIndex ? dotIndex - 1 : dotIndex;
          updateData[path2] = Math.clamped(newVal, 0, 5);
        }
        await doc.update(updateData);
      }
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
});