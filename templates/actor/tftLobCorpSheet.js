import { HunterActorSheet } from "../../../../systems/wod5e/system/actor/htr/hunter-actor-sheet.js";
import { prepareBaseContext } from "../../scripts/scripts.js";

export class LobcorpHunter extends HunterActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["lobcorp"],
    actions: {
      // Spread parent actions so we don't accidentally drop any
      ...HunterActorSheet.DEFAULT_OPTIONS?.actions,
      toggleLock:      LobcorpHunter.#onToggleLock,
      rollAttribute:   LobcorpHunter.#onRollAttribute,
      editAttribute:   LobcorpHunter.#onEditAttribute,
    },
  };

  static PARTS = {
    base: {
      template: "modules/tft-sheets/templates/actor/tftLobCorpSheet.hbs",
    },
  };

  // ── Lock toggle ──────────────────────────────────────────────────────────
  static async #onToggleLock() {
    const scope   = "tft-sheets";
    const current = this.document.getFlag(scope, "sheetLocked") ?? false;
    await this.document.setFlag(scope, "sheetLocked", !current);
  }

  // ── Attribute roll ───────────────────────────────────────────────────────
  // Delegates to the WoD5E roll pipeline via the same method the parent
  // sheet uses internally, so chat output, dice, and modifiers all work.
  static async #onRollAttribute(event, target) {
    const attribute = target.dataset.attribute;
    if (!attribute) return;

    // WoD5E exposes a static roll helper on the system's Actors class.
    // We call it the same way the original sheets do.
    const actor = this.document;
    try {
      // Try the WoD5E v5+ API first
      await actor.sheet._onAttributeRoll?.({ attribute });
    } catch (_) {}

    // Fallback: use the WoD5E global roll handler directly
    const WOD5E = game.system?.api ?? game.wod5e;
    if (WOD5E?.Rolls?.handleRoll) {
      await WOD5E.Rolls.handleRoll({
        actor,
        attribute,
        rollType: "attribute",
      });
      return;
    }

    // Final fallback: fire a synthetic click on the equivalent element that
    // WoD5E's own sheet would render, so the parent handler picks it up.
    // Look for the WoD5E system's own rendered sheet if it exists.
    // Otherwise just open the roll dialog with the attribute pre-selected.
    if (game.wod5e?.RollHandler?.rollAttribute) {
      await game.wod5e.RollHandler.rollAttribute(actor, attribute);
      return;
    }

    // Last resort — open the attribute edit dialog so the player can at
    // least see and modify the value even if rolling isn't available.
    LobcorpHunter.#onEditAttribute.call(this, event, target);
  }

  // ── Attribute edit (opens WoD5E dot-editor dialog) ───────────────────────
  static async #onEditAttribute(event, target) {
    const attribute = target.dataset.attribute;
    if (!attribute) return;
    const actor = this.document;

    // WoD5E ApplicationV2 sheets register _onEditAttribute or similar.
    // Try the parent sheet's own method first.
    if (typeof this._onEditAttribute === "function") {
      return this._onEditAttribute(event, target);
    }

    // Try the system API
    const api = game.system?.api ?? game.wod5e;
    if (api?.ActorUtils?.editAttribute) {
      return api.ActorUtils.editAttribute(actor, attribute);
    }

    // Fallback: inline prompt for the numeric value
    const current = foundry.utils.getProperty(
      actor, `system.attributes.${attribute}.value`
    ) ?? foundry.utils.getProperty(
      actor, `system.${attribute}.value`
    ) ?? 0;

    const newVal = await Dialog.prompt({
      title: `Edit ${attribute}`,
      content: `<input type="number" min="0" max="5" value="${current}" />`,
      callback: (html) => Number(html.find("input").val()),
      rejectClose: false,
    });
    if (newVal == null || isNaN(newVal)) return;

    // Try both possible data paths WoD5E might use
    const updateData = {};
    const path1 = `system.attributes.${attribute}.value`;
    const path2 = `system.${attribute}.value`;
    if (foundry.utils.getProperty(actor, path1) !== undefined) {
      updateData[path1] = Math.clamped(newVal, 0, 5);
    } else {
      updateData[path2] = Math.clamped(newVal, 0, 5);
    }
    await actor.update(updateData);
  }

  async _preparePartContext(partId, context, options) {
    context = {
      ...(await super._preparePartContext(partId, context, options)),
    };
    await prepareBaseContext(context, this.actor);
    return context;
  }
}