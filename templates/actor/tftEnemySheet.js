import { HunterActorSheet } from "../../../../systems/wod5e/system/actor/htr/hunter-actor-sheet.js";
import { prepareBaseContext } from "../../scripts/scripts.js";

export class LobcorpEnemy extends HunterActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["lobcorp-enemy", "lobcorp"],
    actions: {
      ...HunterActorSheet.DEFAULT_OPTIONS?.actions,
      toggleLock: LobcorpEnemy.#onToggleLock,
    },
  };

  static PARTS = {
    base: {
      template: "modules/tft-sheets/templates/actor/tftEnemySheet.hbs",
    },
  };

  // ── Lock toggle ──────────────────────────────────────────────────────────
  static async #onToggleLock() {
    const scope = "tft-sheets";
    const current = this.document.getFlag(scope, "sheetLocked") ?? false;
    await this.document.setFlag(scope, "sheetLocked", !current);
  }

  async _preparePartContext(partId, context, options) {
    context = {
      ...(await super._preparePartContext(partId, context, options)),
    };
    await prepareBaseContext(context, this.actor);
    return context;
  }
}
