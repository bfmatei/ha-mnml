interface CustomIconset {
  getIcon: (name: string) => Promise<{ path: string }>;
  getIconList: () => Promise<{ name: string; keywords: readonly string[] }[]>;
}

declare global {
  interface Window {
    customIcons?: Record<string, CustomIconset>;
  }
}

const ICONS: Readonly<Record<string, { path: string; keywords: readonly string[] }>> = {
  mnml: {
    path: 'M0 0H24V24H0ZM0.662 0.662V23.338H23.338V0.662ZM3.311 10.728L3.311 5.43L4.689 5.43L7.02 7.64L9.351 5.43L10.728 5.43L10.728 10.728L9.563 10.728L9.563 6.739L7.02 9.155L4.477 6.739L4.477 10.728ZM13.272 10.728L13.272 5.43L14.702 5.43L19.523 9.515L19.523 5.43L20.689 5.43L20.689 10.728L19.258 10.728L14.437 6.644L14.437 10.728ZM3.311 18.57L3.311 13.272L4.689 13.272L7.02 15.481L9.351 13.272L10.728 13.272L10.728 18.57L9.563 18.57L9.563 14.58L7.02 16.996L4.477 14.58L4.477 18.57ZM16.238 13.272L20.689 13.272L20.689 18.57L19.523 18.57L19.523 14.358L16.238 14.358Z',
    keywords: ['mnml'],
  },
};

export function registerIcons(): void {
  window.customIcons ??= {};
  window.customIcons['mnml'] = {
    getIcon: (name) => Promise.resolve({ path: ICONS[name]?.path ?? '' }),
    getIconList: () =>
      Promise.resolve(
        Object.entries(ICONS).map(([name, icon]) => ({ name, keywords: icon.keywords })),
      ),
  };
}
