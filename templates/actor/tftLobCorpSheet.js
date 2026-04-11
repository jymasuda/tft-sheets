import { HunterActorSheet } from "../../../../systems/wod5e/system/actor/htr/hunter-actor-sheet.js";
import { prepareBaseContext } from "../../scripts/scripts.js";

export class LobcorpHunter extends HunterActorSheet {
static DEFAULT_OPTIONS = {
  classes: ["lobcorp"],
  actions: {
    ...HunterActorSheet.DEFAULT_OPTIONS?.actions,
    toggleLock: LobcorpHunter.#onToggleLock,
  },
};

  static PARTS = {
    base: {
      template: "modules/tft-sheets/templates/actor/tftLobCorpSheet.hbs",
    },
  };

  // ── Lock toggle ──────────────────────────────────────────────────────────
  static async #onToggleLock() {
    const scope = "tft-sheets";
    const current = this.document.getFlag(scope, "sheetLocked") ?? false;
    await this.document.setFlag(scope, "sheetLocked", !current);
  }

  // ── Attribute roll ───────────────────────────────────────────────────────
  // Called by data-action="rollAttribute" on both system and justice spans.
  // For system attributes WoD5E resolves the pool itself from actor.system.
  // For justice (flag-based) attributes we read the pool from flags and pass
  // it so the dialog opens with the correct number of dice.
  static async #onRollAttribute(event, target) {
    const attribute = target.dataset.attribute;
    if (!attribute) return;

    const actor = this.document;
    const scope = "tft-sheets";

    // ── Determine whether this is a justice (flag-based) attribute ──────────
    // Justice attr keys are "justiceAttr1" / "justiceAttr2".  Any attribute
    // key not present in actor.system.attributes is treated the same way.
    const isJustice =
      attribute.startsWith("justiceAttr") ||
      (foundry.utils.getProperty(actor, `system.attributes.${attribute}`) === undefined &&
        foundry.utils.getProperty(actor, `system.${attribute}`) === undefined);

    // ── Build the call params ────────────────────────────────────────────────
    const rollParams = {
      actor,
      attribute,
      rollType: "attribute",
    };

    if (isJustice) {
      // Read the dice pool from the flag (e.g. justiceAttr1Val → 3 dots filled)
      const pool = Number(actor.getFlag(scope, `${attribute}Val`) ?? 0);
      rollParams.pool = pool;
      rollParams.title = attribute; // label shown in the WoD5E dialog
    }

    // ── Try the WoD5E v5+ API (shows the full dialog with desperation die, ─
    //    challenge level, extra hunter dice, etc.)                            ─
    const WOD5E = game.system?.api ?? game.wod5e;

    if (WOD5E?.Rolls?.handleRoll) {
      try {
        await WOD5E.Rolls.handleRoll(rollParams);
        return;
      } catch (e) {
        console.warn("[TFT] WOD5E.Rolls.handleRoll failed:", e);
      }
    }

    // ── Fallback: try the parent sheet's own roll method ────────────────────
    if (typeof this._onAttributeRoll === "function") {
      try {
        await this._onAttributeRoll({ attribute });
        return;
      } catch (e) {
        console.warn("[TFT] _onAttributeRoll failed:", e);
      }
    }

    // ── Last resort: plain Foundry roll dialog ───────────────────────────────
    // Resolve the pool: for justice use the flag value already computed above,
    // for system attrs walk the two most common WoD5E data paths.
    const attrValue = rollParams.pool
      ?? Number(foundry.utils.getProperty(actor, `system.attributes.${attribute}.value`))
      ?? Number(foundry.utils.getProperty(actor, `system.${attribute}.value`))
      ?? 0;

    const label = attribute.charAt(0).toUpperCase() + attribute.slice(1);
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

  async _preparePartContext(partId, context, options) {
    context = {
      ...(await super._preparePartContext(partId, context, options)),
    };
    await prepareBaseContext(context, this.actor);
    return context;
  }
}