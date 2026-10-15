export interface Drawing {
  readonly redraw: boolean;
}

export const REDRAW: Drawing = { redraw: true };

export const IN_PLACE: Drawing = { redraw: false };
