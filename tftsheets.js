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

  paleDamage(app, html);
  sinPointsRender(app, html);

  // ── DIAGNOSTIC — capture-phase logger on the sheet root ─────────────────
  // Open the browser console (F12) and right-click a health/sanity square.
  // The log will show: what element was clicked, its classes/dataset, whether
  // closest(".resource-counter-step") finds it, and the parent counter's
  // data-name. Paste the output so we can see exactly what the DOM looks like.
  html.addEventListener("contextmenu", (e) => {
    const step = e.target.closest(".resource-counter-step");
    console.log("[TFT-PALE] contextmenu (capture)", {
      target:            e.target,
      targetTag:         e.target.tagName,
      targetId:          e.target.id,
      targetClasses:     [...e.target.classList],
      targetDataset:     { ...e.target.dataset },
      defaultPrevented:  e.defaultPrevented,
      cancelable:        e.cancelable,
      closestStep:       step,
      stepClasses:       step ? [...step.classList] : null,
      stepDataset:       step ? { ...step.dataset } : null,
      closestCounter:    step?.closest(".resource-counter"),
      counterDataName:   step?.closest(".resource-counter")?.dataset?.name,
      counterDataStates: step?.closest(".resource-counter")?.dataset?.states,
    });
  }, true); // true = capture phase, fires before any bubbling handler

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

  // ── Combat skill type selects ─────────────────────────────────────────────
  html.querySelectorAll(".combat-skill-type-select").forEach(sel => {
    sel.value = sel.dataset.currentType ?? "attack";
    sel.addEventListener("change", async () => {
      const itemId = sel.dataset.itemId;
      const item = app.document.items.get(itemId);
      if (!item) return;
      await item.setFlag(scope, "skillType", sel.value);
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

  // ── RP entries — ping to chat ─────────────────────────────────────────────
  html.querySelectorAll(".rp-ping-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.entryId;
      const entries = app.document.getFlag(scope, "rpEntries") ?? [];
      const entry = entries.find(e => e.id === id);
      if (!entry) return;

      const actor = app.document;

      const typeColors = {
        "Core Passive":       "#ffffa0",
        "EGO Gift":           "#f0a33f",
        "Passive":            "#a3a075",
        "Flaw":               "#da4c33",
        "Reputation Passive": "#9c69b2",
        "Reputation Flaw":    "#da4c33",
        "Ally Passive":       "#56b4c9",
        "Ally Flaw":          "#da4c33",
        "EGO Resonance":      "#b3d42f",
        "Resonance":          "#b3d42f",
      };
      const typeColor = typeColors[entry.type] ?? "#a3a075";

      const content = `
        <div class="wod5e chat-card" style="
          background: #0c0c08;
          border: 1px solid #777459;
          padding: 8px 10px;
          font-family: 'GillSansMT', Arial, sans-serif;
          color: #a3a075;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #5f5d44;
            padding-bottom: 6px;
            margin-bottom: 6px;
          ">
            <img src="${actor.img}" width="36" height="36"
              style="border:none; border-radius:0; object-fit:cover;" />
            <div>
              <div style="
                font-family: Norwester, Arial;
                font-size: 15px;
                color: #ffffa0;
                text-shadow: 0 0 4px #ff9442;
                line-height: 1.1;
              ">${entry.name || "Unnamed"}</div>
              <div style="
                font-size: 10px;
                letter-spacing: 1px;
                color: ${typeColor};
                font-family: Norwester, Arial;
              ">${entry.type} &mdash; ${actor.name}</div>
            </div>
          </div>
          <div style="font-size: 13px; line-height: 1.5; color: #a3a075;">
            ${entry.desc || "<em>No description.</em>"}
          </div>
        </div>
      `;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        flags: { "tft-sheets": { rpEntryPing: true, entryId: id } },
      });
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