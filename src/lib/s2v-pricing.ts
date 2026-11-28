/** Script-to-Video only pricing (never used by other tools). Analysis/breakdown are free. */
export type S2vPrices = { sceneImage: number; anim5: number; anim10: number; render: number };
export const S2V_DEFAULT_PRICES: S2vPrices = { sceneImage: 225, anim5: 750, anim10: 1500, render: 75 };

export function s2vBreakdown(scenes: number, clipSeconds: 5 | 10, p: S2vPrices = S2V_DEFAULT_PRICES) {
  const images = scenes * p.sceneImage;
  const animation = scenes * (clipSeconds === 10 ? p.anim10 : p.anim5);
  const render = scenes > 0 ? p.render : 0;
  return { analysis: 0, images, animation, render, total: images + animation + render };
}

export function pricesFromSettings(s: { price_scene_image: number; price_anim_5: number; price_anim_10: number; price_render: number }): S2vPrices {
  return { sceneImage: s.price_scene_image, anim5: s.price_anim_5, anim10: s.price_anim_10, render: s.price_render };
}
