/**
 * The colour of the bar of a row (design/play-a/DESIGN.md, "Colour bars"). One place for every screen:
 * a quest or an item that belongs to a box takes the colour of that box from My collection; whatever the
 * player made, and anything that cannot be linked to a box, is neutral.
 */
import { CORE_PACK } from '../engine/pack/registry';
import { useBoxColors } from './collection';
import { packs } from './packs';

/** The bar of what the player made (a quest, an enemy, a library item): an existing token. */
export const NEUTRAL_BAR = 'var(--muted)';

/** What the lookup needs: the colour of each box and the names of the boxes. */
export interface BarContext {
  /** The colour of each box, by pack id (`useBoxColors`). */
  readonly colors: Readonly<Record<string, string>>;
  /** The installed boxes: pack id and the name an item calls its expansion by. */
  readonly packs: readonly { readonly id: string; readonly name: string }[];
}

/** The pack of an expansion name ("Frozen Horror"), or undefined when no installed box has that name. */
export function packOfExpansion(expansion: string, list: BarContext['packs']): string | undefined {
  return list.find((p) => p.name === expansion)?.id;
}

/** The bar of a quest by its pack id. No pack: made on this device, so neutral. */
export function barOfPack(pack: string | undefined, ctx: BarContext): string {
  if (pack === undefined) return NEUTRAL_BAR;
  return ctx.colors[pack] ?? NEUTRAL_BAR;
}

/**
 * The bar of an item by its expansion name (an enemy, an ability, a spell). `made` is true for what the
 * player made: neutral. No expansion is the base game. An expansion that no installed box is called
 * after cannot be linked to a colour, so it is neutral.
 */
export function barOfExpansion(
  expansion: string | undefined,
  made: boolean,
  ctx: BarContext,
): string {
  if (made) return NEUTRAL_BAR;
  if (expansion === undefined) return barOfPack(CORE_PACK, ctx);
  return barOfPack(packOfExpansion(expansion, ctx.packs), ctx);
}

/** The lookup for the screen on show: the colours chosen in My collection and the installed boxes. */
export function useBarContext(): BarContext {
  const list = packs.packs.map((p) => ({ id: p.manifest.id, name: p.manifest.name }));
  const colors = useBoxColors(list.map((p) => p.id));
  return { colors, packs: list };
}
