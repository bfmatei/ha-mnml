import { chromium } from 'playwright';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright';

import type { Env } from './env.ts';

export const VIEWPORTS: Readonly<Record<'phone' | 'desktop', BrowserContextOptions>> = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};

export function launch(): Promise<Browser> {
  return chromium.launch();
}

export async function signedIn(
  browser: Browser,
  env: Env,
  options: BrowserContextOptions,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  await context.addInitScript(
    ([hassUrl, token]) => {
      localStorage.setItem(
        'hassTokens',
        JSON.stringify({
          access_token: token,
          token_type: 'Bearer',
          expires_in: 315360000,
          hassUrl,
          clientId: null,
          refresh_token: '',
          expires: Date.now() + 315360000000,
        }),
      );
    },
    [env.HA_URL, env.HA_TOKEN],
  );
  return { context, page: await context.newPage() };
}

export async function useTheme(page: Page, theme: string, dark: boolean): Promise<void> {
  await page.evaluate(
    ([wanted, isDark]) => {
      document.querySelector('home-assistant')?.dispatchEvent(
        new CustomEvent('settheme', {
          detail: { theme: wanted, dark: isDark },
          bubbles: true,
          composed: true,
        }),
      );
    },
    [theme, dark] as const,
  );
  await page.waitForTimeout(3000);
}

export function errorCards(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const walk = (node: Element): void => {
      if (node.localName === 'hui-error-card') {
        found.push(node.textContent?.trim().slice(0, 160) ?? 'error card');
      }
      for (const child of [...(node.shadowRoot?.children ?? []), ...node.children]) {
        walk(child);
      }
    };
    walk(document.documentElement);
    return found;
  });
}

export async function navigate(page: Page, hash: string): Promise<void> {
  await page.evaluate((target) => {
    history.pushState(null, '', target);
    window.dispatchEvent(new CustomEvent('location-changed'));
  }, hash);
}
