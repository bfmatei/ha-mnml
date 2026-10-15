const timer = globalThis.setTimeout;
const now = Date.now;
const PATIENCE = 2000;

export async function until(
  holds: () => boolean | Promise<boolean>,
  what = 'the condition',
): Promise<void> {
  const end = now() + PATIENCE;
  const look = async (): Promise<void> => {
    await new Promise((resolve) => {
      timer(resolve, 0);
    });
    if (await holds()) {
      return;
    }
    if (now() > end) {
      throw new Error(`${what} never came`);
    }
    await look();
  };
  await look();
}
