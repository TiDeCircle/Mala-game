// Pick-stage buttons and the weight / price stamp on the order slip.
import { state, dom, getTotalWeight, getTotalPrice, isTouchDevice } from './core/context.js';

export function updateHUD() {
  const count = state.picked.length;
  const grams = getTotalWeight();
  const price = getTotalPrice();

  dom.btnUndo.disabled = count === 0;
  dom.btnClear.disabled = count === 0;
  dom.btnToWeigh.disabled = count === 0;
  // On phones the hint sits over the clear bowl — drop it once the player has got the idea.
  dom.dockHint.classList.toggle('hidden', isTouchDevice && count > 0);

  dom.weighGramsEl.textContent = `${grams} กรัม (${(grams / 100).toFixed(1)} ขีด)`;
  dom.weighPriceEl.textContent = `฿${price}.-`;
}
