import { HunterActorSheet } from "../../../../systems/wod5e/system/actor/htr/hunter-actor-sheet.js";
import { prepareBaseContext } from "../../scripts/scripts.js";

export class LobcorpHunter extends HunterActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["lobcorp"],
  };

  static PARTS = {
    base: {
      template: "modules/tft-sheets/templates/actor/tftLobCorpSheet.hbs",
    },
  };

  async _preparePartContext(partId, context, options) {
    // Inherit base context from the parent WoD5e hunter sheet
    context = {
      ...(await super._preparePartContext(partId, context, options)),
    };

    // Enrich with our custom context data
    await prepareBaseContext(context, this.actor);

    return context;
  }
}
