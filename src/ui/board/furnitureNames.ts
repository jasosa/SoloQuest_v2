/** Plain English names of the furniture types, for the label and the note eyebrow. */
import type { FurnitureDef } from '../../engine/quest/schema';

export const FURNITURE_NAMES: Readonly<Record<FurnitureDef['type'], string>> = {
  stairs: 'Stairway',
  table: 'Table',
  sorcerersTable: "Sorcerer's table",
  alchemistsBench: "Alchemist's bench",
  bookcase: 'Bookcase',
  cupboard: 'Cupboard',
  chest: 'Chest',
  throne: 'Throne',
  tomb: 'Tomb',
  rack: 'Torture rack',
  weaponsRack: 'Weapons rack',
  fireplace: 'Fireplace',
};

export const furnitureName = (type: FurnitureDef['type']): string => FURNITURE_NAMES[type];
