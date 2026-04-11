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
  foundry.documents.collections.Actors.registerSheet("tft-sheets", LobcorpHunter, {
    types: ["hunter"],
    makeDefault: true,
    label: "TFT Lob Corp Sheet",
  });
});

Hooks.once("ready", function () { });

// ---------------------------------------------------------------------------
// Resistance select options
// ---------------------------------------------------------------------------
const RESIST_OPTIONS = {
  Fatal: "Fatal",
  Weak: "Weak",
  Normal: "Normal",
  Endured: "Endured",
  Immune: "Immune",
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
      if (overridePool !== null) {
        rollData.pool = overridePool;
        rollData.title = attributeKey;
      }
      await api.Rolls.handleRoll(rollData);
      return;
    } catch (e) { console.warn("[TFT] api.Rolls.handleRoll failed:", e); }
  }

  // ── Method 2: WoD5E RollHandler ───────────────────────────────────────────
  if (api?.RollHandler?.rollAttribute) {
    try {
      await api.RollHandler.rollAttribute(actor, attributeKey);
      return;
    } catch (e) { console.warn("[TFT] RollHandler.rollAttribute failed:", e); }
  }

  // ── Method 3: Direct WoD5E roll function from its module scope ───────────
  if (game.wod5e?.rolls?.rollAttribute) {
    try {
      await game.wod5e.rolls.rollAttribute({ actor, attribute: attributeKey });
      return;
    } catch (e) { console.warn("[TFT] game.wod5e.rolls.rollAttribute failed:", e); }
  }

  // ── Method 4: Fallback — open the standard Foundry roll dialog ────────────
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
    {
      WRATH: "WRATH", LUST: "LUST", SLOTH: "SLOTH", GLUTTONY: "GLUTTONY",
      GLOOM: "GLOOM", PRIDE: "PRIDE", ENVY: "ENVY"
    }
  );

  paleDamage(app, html.getElementsByClassName("resource-counter-step"));
  sinPointsRender(app, html);

  // ── Armor title ───────────────────────────────────────────────────────────
  const armorTitleInput = html.querySelector(".armor-title-input");
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
        type: "image",
        current: app.document.getFlag(scope, iconFlag) ?? "",
        callback: async (path) => {
          await app.document.setFlag(scope, iconFlag, path);
        },
      }).browse();
    });
  });

  // ── Attribute dots — system attributes ───────────────────────────────────
  // NOTE: system-rollable spans carry data-action="rollAttribute" which is
  // handled by LobcorpHunter.#onRollAttribute via ApplicationV2's dispatcher.
  // No duplicate click listener is added here.

  // ── Attribute dots — click to set value ──────────────────────────────────
  html.querySelectorAll(".attr-dots").forEach(dotContainer => {
    dotContainer.querySelectorAll(".attr-dot").forEach(dot => {
      dot.addEventListener("click", async () => {
        const attrId = dotContainer.dataset.attrId;
        if (!attrId) return;
        const clickedIndex = parseInt(dot.dataset.dotIndex);
        const currentValue = parseInt(dotContainer.dataset.attrValue) || 0;
        const newValue = currentValue === clickedIndex ? clickedIndex - 1 : clickedIndex;
        await app.document.update({
          [`system.attributes.${attrId}.value`]: newValue,
        });
      });
    });
  });

  // ── RP entries — type selects ─────────────────────────────────────────────
  html.querySelectorAll(".rp-type-select").forEach(sel => {
    sel.value = sel.dataset.currentType ?? "Passive";
    sel.addEventListener("change", async () => {
      const id = sel.dataset.entryId;
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
      const id = btn.dataset.entryId;
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
      id: foundry.utils.randomID(),
      type: "Passive",
      name: "",
      desc: "",
    });
    await app.document.setFlag(scope, "rpEntries", entries);
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

// ---------------------------------------------------------------------------
// Patch the WoD5E "Select Roll" dialog so renamed attributes/skills show
// the actor's custom displayName instead of the system default label.
//
// The dialog is a Foundry ApplicationV2 whose title matches the actor, and
// its selects carry data-name / name attributes we can read for the actor id.
// We fish the actor out of the most-recently opened sheet.
// ---------------------------------------------------------------------------
Hooks.on("renderApplication", (app, html) => {
  // Target only the WoD5E select-roll dialog (class varies by version)
  const isSelectDialog =
    app.constructor?.name?.toLowerCase().includes("selectroll") ||
    app.constructor?.name?.toLowerCase().includes("wod5eselect") ||
    html.querySelector?.(".roll-dice-selectors") !== null;

  if (!isSelectDialog) return;

  // Recover the actor whose sheet last triggered a roll.
  // WoD5E stores the originating actor uuid/id on the dialog options.
  const actorId =
    app.options?.actorId ??
    app.options?.actor?.id ??
    app.object?.id;

  const actor = actorId
    ? game.actors.get(actorId)
    : _lastRollingActor;          // fallback — see tracker hook below

  if (!actor) return;

  // Build a flat map: { [wod5eId]: customDisplayName }
  const nameMap = {};

  for (const group of Object.values(actor.system.sortedAttributes ?? {})) {
    const rawAttrs = group.attributes ?? group;
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (k === "label") continue;
      const customName = v.displayName ?? v.label;
      const systemDefault = game.i18n.localize(
        CONFIG.WOD5E?.Attributes?.[k]?.label ?? ""
      );
      // Only patch when the actor has a non-default name
      if (customName && customName !== systemDefault) {
        nameMap[k] = customName;
      }
    }
  }

  for (const group of Object.values(actor.system.sortedSkills ?? {})) {
    for (const [k, v] of Object.entries(group)) {
      if (k === "label") continue;
      const customName = v.displayName ?? v.label;
      const systemDefault = game.i18n.localize(
        CONFIG.WOD5E?.Skills?.[k]?.label ?? ""
      );
      if (customName && customName !== systemDefault) {
        nameMap[k] = customName;
      }
    }
  }

  if (!Object.keys(nameMap).length) return;

  // Patch every <option> in every <select> inside the dialog
  const root = html instanceof HTMLElement ? html : html[0];
  root.querySelectorAll("select option").forEach(opt => {
    const id = opt.value;
    if (nameMap[id]) opt.textContent = nameMap[id];
  });
});

// ---------------------------------------------------------------------------
// Track which actor most recently triggered a roll so we can recover it
// in renderApplication above when the dialog doesn't carry actorId.
// ---------------------------------------------------------------------------
let _lastRollingActor = null;

Hooks.on("renderLobcorpHunter", (app) => {
  // Every time our sheet renders, record its actor as the "last rolling" one.
  // This is a best-effort fallback; WoD5E may pass actorId directly.
  _lastRollingActor = app.document;
});