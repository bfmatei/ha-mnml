const FAMILY_TITLES: Readonly<Record<string, string>> = {
  '3d-printer': '3D printer',
  adguard: 'AdGuard Home',
  car: 'Car',
  climate: 'Climate',
  common: 'Common parts',
  devices: 'Devices',
  energy: 'Energy',
  glances: 'Glances',
  'home-assistant': 'Home Assistant',
  lights: 'Lights',
  media: 'Media server',
  network: 'Network',
  people: 'People',
  room: 'Room',
  server: 'Proxmox VE server',
  speaker: 'Speaker',
  tailscale: 'Tailscale',
  vacuum: 'Vacuum',
};

export function familyTitle(family: string): string {
  return Object.hasOwn(FAMILY_TITLES, family) ? (FAMILY_TITLES[family] ?? family) : family;
}
