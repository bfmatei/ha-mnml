import type { CustomCard } from './cards.ts';
import type { MdiIcon } from './entities.ts';

export type Card = CustomCard & { grid_options?: { columns: number } };

export interface Section {
  type: 'grid';
  column_span: number;
  cards: Card[];
}

interface View {
  title: string;
  path: string;
  icon: MdiIcon;
  type: 'sections';
  max_columns: number;
  sections: Section[];
}

export interface Dashboard {
  title: string;
  views: View[];
}
