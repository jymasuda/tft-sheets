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

  // ── Right panel — resistance dropdowns ──────────────────────────────
  for (let n = 1; n <= 4; n++) {
    inputCreate(app, options, "base", `resist${n}`, "Normal",
      html.querySelector(`.resist-input-${n}`),
      html.querySelector(`.resist-display-${n}`)
    );
  }

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

  // Description textareas are rendered directly in HBS; bind change events
  // so they persist immediately without needing a full form submit.
  html.querySelectorAll(".rp-desc-textarea").forEach(ta => {
    ta.addEventListener("change", async () => {
      const flagKey = ta.dataset.flagKey;
      if (flagKey) await app.document.setFlag("tft-sheets", flagKey, ta.value);
    });
  });

  // ── Attribute dots — click to edit via system dialog ────────────────
  // Dots are rendered in HBS; clicking the edit icon opens the system's
  // built-in attribute dialog. No custom logic needed here — the system's
  // squareCounterChange action handles it.

  // ── Skill specialty inputs — debounced save ──────────────────────────
  html.querySelectorAll(".skill-spec-input").forEach(input => {
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // The input's name="system.skills.X.specialty" is submitted via
        // the standard ApplicationV2 form handling on the next render.
      }, 600);
    });
  });
});
