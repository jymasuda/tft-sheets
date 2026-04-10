import { HunterActorSheet } from "../../../../systems/wod5e/system/actor/htr/hunter-actor-sheet.js";
import { prepareBaseContext } from "../../scripts/scripts.js";

export class LobcorpHunter extends HunterActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["lobcorp"],
    actions: {
      // Spread parent actions so we don't accidentally drop any
      ...HunterActorSheet.DEFAULT_OPTIONS?.actions,
      toggleLock: LobcorpHunter.#onToggleLock,
    },
  };

  static PARTS = {
    base: {
      template: "modules/tft-sheets/templates/actor/tftLobCorpSheet.hbs",
    },
  };

  // Private static — `this` inside is the sheet instance when called via data-action
  static async #onToggleLock() {
    const scope   = "tft-sheets";
    const current = this.document.getFlag(scope, "sheetLocked") ?? false;
    await this.document.setFlag(scope, "sheetLocked", !current);
    // setFlag triggers a re-render automatically; context.locked is now read
    // fresh from the flag in prepareBaseContext on every render.
  }

  async _preparePartContext(partId, context, options) {
    context = {
      ...(await super._preparePartContext(partId, context, options)),
    };
    await prepareBaseContext(context, this.actor);
    return context;
  }
}