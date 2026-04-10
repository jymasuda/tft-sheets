import { LobcorpHunter } from "./templates/actor/tftLobCorpSheet.js";
import { inputCreate, paleDamage, sinPointsRender } from "./scripts/scripts.js";

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
// Colour damage rows: key → flag key for icon path
// ---------------------------------------------------------------------------
const COLOR_DAMAGE_ROWS = [
  { color: "red",   flagKey: "resistRed",   iconFlag: "iconRed"   },
  { color: "white", flagKey: "resistWhite", iconFlag: "iconWhite" },
  { color: "black", flagKey: "resistBlack", iconFlag: "iconBlack" },
  { color: "pale",  flagKey: "resistPale",  iconFlag: "iconPale"  },
];

// ---------------------------------------------------------------------------
// Main render hook
// ---------------------------------------------------------------------------
Hooks.on("renderLobcorpHunter", (app, html, context, options) => {
  // ── Agent panel — blurb & sin-type fields ────────────────────────────
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

  // ── Pale damage on resource steps ───────────────────────────────────
  paleDamage(app, html.getElementsByClassName("resource-counter-step"));

  // ── Sin points tracker ───────────────────────────────────────────────
  sinPointsRender(app, html);

  // ── Right panel — physical resistance dropdowns (1-4) ────────────────
  const physicalLabels = ["Slash", "Pierce", "Blunt", "Ego"];
  for (let n = 1; n <= 4; n++) {
    inputCreate(app, options, "base", `resist${n}`, "Normal",
      html.querySelector(`.resist-input-${n}`),
      html.querySelector(`.resist-display-${n}`),
      RESIST_OPTIONS   // ← was missing; was creating plain text inputs
    );
  }

  // ── Right panel — colour damage resistance dropdowns ─────────────────
  for (const { color, flagKey } of COLOR_DAMAGE_ROWS) {
    const capColor = color.charAt(0).toUpperCase() + color.slice(1);
    inputCreate(app, options, "base", `resist${capColor}`, "Normal",
      html.querySelector(`.resist-input-${color}`),
      html.querySelector(`.resist-display-${color}`),
      RESIST_OPTIONS
    );
  }

  // ── Colour damage icons — FilePicker on click (unlocked only) ────────
  html.querySelectorAll(".dmg-type-icon.clickable").forEach(img => {
    img.addEventListener("click", () => {
      const { iconFlag } = img.dataset;
      if (!iconFlag) return;
      new FilePicker({
        type:     "image",
        current:  app.document.getFlag("tft-sheets", iconFlag) ?? "",
        callback: async (path) => {
          await app.document.setFlag("tft-sheets", iconFlag, path);
        },
      }).browse();
    });
  });

  // ── Right panel — named entry fields (EGO Gift, Ally Passive, etc.) ─
  const rpFields = [
    ["egoGiftName",     ".ego-gift-name-input",     ".ego-gift-name-display"],
    ["allyPassiveName", ".ally-passive-name-input",  ".ally-passive-name-display"],
    ["repFlawName",     ".rep-flaw-name-input",      ".rep-flaw-name-display"],
    ["allyFlawName",    ".ally-flaw-name-input",     ".ally-flaw-name-display"],
  ];
  for (const [key, unlockSel, lockSel] of rpFields) {
    inputCreate(app, options, "base", key, "",
      html.querySelector(unlockSel),
      html.querySelector(lockSel)
    );
  }

  // Description textareas persist immediately without a full form submit
  html.querySelectorAll(".rp-desc-textarea").forEach(ta => {
    ta.addEventListener("change", async () => {
      const flagKey = ta.dataset.flagKey;
      if (flagKey) await app.document.setFlag("tft-sheets", flagKey, ta.value);
    });
  });

  // ── Skill specialty inputs — debounced save ──────────────────────────
  html.querySelectorAll(".skill-spec-input").forEach(input => {
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // name="system.skills.X.specialty" handled by ApplicationV2 form
      }, 600);
    });
  });
});