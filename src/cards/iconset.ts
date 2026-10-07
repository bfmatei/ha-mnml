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
    path: 'M0 0H24V24H0ZM0.874 0.874V23.126H23.126V0.874ZM3.205 10.834L3.205 5.325L4.731 5.325L7.02 7.494L9.309 5.325L10.834 5.325L10.834 10.834L9.457 10.834L9.457 6.986L7.02 9.301L4.583 6.986L4.583 10.834ZM13.166 10.834L13.166 5.325L14.741 5.325L19.417 9.287L19.417 5.325L20.795 5.325L20.795 10.834L19.219 10.834L14.543 6.872L14.543 10.834ZM3.205 18.675L3.205 13.166L4.731 13.166L7.02 15.335L9.309 13.166L10.834 13.166L10.834 18.675L9.457 18.675L9.457 14.827L7.02 17.142L4.583 14.827L4.583 18.675ZM16.132 13.166L20.795 13.166L20.795 18.675L19.417 18.675L19.417 14.464L16.132 14.464Z',
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
