/** Map item IDs to short icon-like labels for the inventory grid */
export function getItemIcon(itemId: string): string {
  const map: Record<string, string> = {
    basement_key: 'KEY',
    bloody_note: 'NOTE',
    carl_journal: 'BOOK',
    broken_phone: 'PHONE',
    missing_flyer: 'FLYR',
    pet_collar: 'COLR',
    paul_recipe: 'RCPE',
    dirty_shovel: 'SHVL',
    police_badge: 'BDGE',
    police_radio: 'RDIO',
    newspaper: 'NEWS',
    dropped_keys: 'KEYS',
    marked_map: 'MAP',
  };
  return map[itemId] ?? itemId.slice(0, 3).toUpperCase();
}
