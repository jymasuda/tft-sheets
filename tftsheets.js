import { LobcorpHunter } from "./templates/actor/tftLobCorpSheet.js";
import { LobcorpEnemy } from "./templates/actor/tftEnemySheet.js";
import {
  inputCreate,
  paleDamage,
  sinPointsRender,
  updateRpEntry,
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

  foundry.documents.collections.Actors.registerSheet("tft-sheets", LobcorpEnemy, {
    types: ["hunter"],
    makeDefault: false,
    label: "TFT Enemy Sheet",
  });
});

// ---------------------------------------------------------------------------
// Resistance select options
// ---------------------------------------------------------------------------
const RESIST_OPTIONS = {
  Fatal: "Fatal",
  Weak: "Weak",
  Normal: "Normal",
  Endured: "Endured",
  Resistant: "Resistant",
  Immune: "Immune",
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Wires combat skill type selects — used by both sheets. */
function bindCombatSkillTypeSelects(app, html) {
  const scope = "tft-sheets";
  html.querySelectorAll(".combat-skill-type-select").forEach(sel => {
    sel.value = sel.dataset.currentType ?? "attack";
    sel.addEventListener("change", async () => {
      const item = app.document.items.get(sel.dataset.itemId);
      if (!item) return;
      await item.setFlag(scope, "skillType", sel.value);
    });
  });
}

/** Wires all RP-entry controls — used by both sheets. */
function bindRpEntryControls(app, html) {
  const scope = "tft-sheets";

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

  html.querySelectorAll(".rp-name-field").forEach(input => {
    input.addEventListener("change", async () => {
      await updateRpEntry(app, input.dataset.entryId, { name: input.value });
    });
  });

  html.querySelectorAll(".rp-desc-textarea").forEach(ta => {
    ta.addEventListener("change", async () => {
      await updateRpEntry(app, ta.dataset.entryId, { desc: ta.value });
    });
  });

  html.querySelectorAll(".rp-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const entries = (app.document.getFlag(scope, "rpEntries") ?? [])
        .filter(e => e.id !== btn.dataset.entryId);
      await app.document.setFlag(scope, "rpEntries", entries);
    });
  });

  html.querySelector(".rp-add-btn")?.addEventListener("click", async () => {
    const entries = foundry.utils.duplicate(
      app.document.getFlag(scope, "rpEntries") ?? []
    );
    entries.push({ id: foundry.utils.randomID(), type: "Passive", name: "", desc: "" });
    await app.document.setFlag(scope, "rpEntries", entries);
  });

  // Ping to chat
  html.querySelectorAll(".rp-ping-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.entryId;
      const entries = app.document.getFlag(scope, "rpEntries") ?? [];
      const entry = entries.find(e => e.id === id);
      if (!entry) return;

      const actor = app.document;
      const typeColors = {
        "Core Passive": "#ffffa0", "EGO Gift": "#f0a33f", "Passive": "#a3a075",
        "Flaw": "#da4c33", "Reputation Passive": "#9c69b2", "Reputation Flaw": "#da4c33",
        "Ally Passive": "#56b4c9", "Ally Flaw": "#da4c33",
        "EGO Resonance": "#b3d42f", "Resonance": "#b3d42f",
      };
      const typeColor = typeColors[entry.type] ?? "#a3a075";

      const content = `
        <div class="wod5e chat-card" style="
          background: #0c0c08; border: 1px solid #777459;
          padding: 8px 10px; font-family: 'GillSansMT', Arial, sans-serif; color: #a3a075;">
          <div style="display:flex;align-items:center;gap:8px;
            border-bottom:1px solid #5f5d44;padding-bottom:6px;margin-bottom:6px;">
            <img src="${actor.img}" width="36" height="36"
              style="border:none;border-radius:0;object-fit:cover;" />
            <div>
              <div style="font-family:Norwester,Arial;font-size:15px;color:#ffffa0;
                text-shadow:0 0 4px #ff9442;line-height:1.1;">
                ${entry.name || "Unnamed"}</div>
              <div style="font-size:10px;letter-spacing:1px;color:${typeColor};
                font-family:Norwester,Arial;">
                ${entry.type} &mdash; ${actor.name}</div>
            </div>
          </div>
          <div style="font-size:13px;line-height:1.5;color:#a3a075;">
            ${entry.desc || "<em>No description.</em>"}
          </div>
        </div>`;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        flags: { "tft-sheets": { rpEntryPing: true, entryId: id } },
      });
    });
  });
}

// ---------------------------------------------------------------------------
// AGENT SHEET — main render hook
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

  paleDamage(app, html);
  sinPointsRender(app, html);

  // ── Armor title ───────────────────────────────────────────────────────────
  inputCreate(app, options, "base", "armorTitle", "",
    html.querySelector(".armor-title-input"),
    html.querySelector(".armor-title-display")
  );

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

  // ── Changeable icons ─────────────────────────────────────────────────────
  html.querySelectorAll(".dmg-type-icon.clickable, .stat-cat-icon.clickable, .armor-img.clickable").forEach(img => {
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

  bindCombatSkillTypeSelects(app, html);
  bindRpEntryControls(app, html);
});

// ---------------------------------------------------------------------------
// ENEMY SHEET — render hook
// ---------------------------------------------------------------------------
Hooks.on("renderLobcorpEnemy", (app, html, context, options) => {
  const scope = "tft-sheets";

  // ── Sin flag colour & pips ────────────────────────────────────────────────
  inputCreate(app, options, "base", "sinFlag", "WRATH",
    null,   // no unlockTarget needed for colour-only
    null,
  );
  sinPointsRender(app, html);
  paleDamage(app, html);

  // ── Abno ID field ─────────────────────────────────────────────────────────
  inputCreate(app, options, "base", "abnoId", "???",
    html.querySelector(".enemy-abnoid-input"),
    html.querySelector(".enemy-abnoid-display")
  );

  // ── Stats summary line (textarea — handled manually) ──────────────────────
  const statsInput = html.querySelector(".enemy-statsline-input");
  const statsDisplay = html.querySelector(".enemy-statsline-display");

  if (statsInput) {
    const ta = document.createElement("textarea");
    ta.placeholder = "Challenge X/Y – HP # – SP # – (Tough) – Armor # – Speed # – # Slot(s) – (Class) – (Phase #)";
    ta.rows = 2;
    ta.style.width = "100%";
    ta.style.boxSizing = "border-box";
    ta.value = app.document.getFlag(scope, "enemyStatsLine") ?? "Challenge X/Y – HP # – SP # – (Tough) – Armor # – Speed # – # Slot(s) – (Class) – (Phase #)";
    statsInput.appendChild(ta);
    ta.addEventListener("change", async () => {
      await app.document.setFlag(scope, "enemyStatsLine", ta.value);
    });
  }

  if (statsDisplay) {
    const val = app.document.getFlag(scope, "enemyStatsLine") ?? "";
    statsDisplay.textContent = val;
  }

  // ── Physical resistance dropdowns (Form: Slash / Pierce / Blunt) ──────────
  for (let n = 1; n <= 3; n++) {
    inputCreate(app, options, "base", `resist${n}`, "Normal",
      html.querySelector(`.enemy-resist-input-${n}`),
      html.querySelector(`.enemy-resist-display-${n}`),
      RESIST_OPTIONS
    );
  }

  // ── Colour resistance dropdowns (Type: RED / WHITE / BLACK / PALE) ────────
  for (const color of ["red", "white", "black", "pale"]) {
    const cap = color.charAt(0).toUpperCase() + color.slice(1);
    inputCreate(app, options, "base", `resist${cap}`, "Normal",
      html.querySelector(`.enemy-resist-input-${color}`),
      html.querySelector(`.enemy-resist-display-${color}`),
      RESIST_OPTIONS
    );
  }

  // ── Clickable damage-type icons in the resist panel ───────────────────────
  html.querySelectorAll(".enemy-dmg-icon.clickable").forEach(img => {
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

  // ── "Add Passive" button (separate from .rp-add-btn on enemy sheet) ───────
  html.querySelector(".enemy-add-passive")?.addEventListener("click", async () => {
    const entries = foundry.utils.duplicate(
      app.document.getFlag(scope, "rpEntries") ?? []
    );
    entries.push({ id: foundry.utils.randomID(), type: "Passive", name: "", desc: "" });
    await app.document.setFlag(scope, "rpEntries", entries);
  });

  bindCombatSkillTypeSelects(app, html);
  bindRpEntryControls(app, html);
});