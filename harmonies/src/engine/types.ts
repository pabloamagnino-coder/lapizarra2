export type Color = 'blue' | 'gray' | 'brown' | 'green' | 'yellow' | 'red';

export const COLORS: Color[] = ['blue', 'gray', 'brown', 'green', 'yellow', 'red'];

/** Stack of tokens on one hex, bottom → top. */
export type Stack = Color[];

export interface Cell {
  stack: Stack;
  /** Id of the animal card whose cube sits here (blocks further stacking). */
  cube: string | null;
}

export type Board = Cell[];

/** What a pattern hex requires. */
export type Req =
  | 'water'
  | 'field'
  | 'tree1'
  | 'tree2'
  | 'tree3'
  | 'mountain1'
  | 'mountain2'
  | 'mountain3'
  | 'building';

export type Creature =
  | 'quadruped'
  | 'bird'
  | 'fish'
  | 'frog'
  | 'insect'
  | 'turtle';

export interface PatternHex {
  dq: number;
  dr: number;
  req: Req;
}

export interface AnimalCard {
  id: string;
  name: string;
  emoji: string;
  creature: Creature;
  /** Colors / proportions used to build the 3D figure. */
  look: CreatureLook;
  /** pattern[0] is where the cube goes (offset 0,0). */
  pattern: PatternHex[];
  /** Points shown on the card; score = points[placed - 1]. Length = number of cubes. */
  points: number[];
}

export interface CreatureLook {
  body: number;
  accent: number;
  size?: number;
  ears?: 'pointy' | 'round' | 'long' | 'none';
  antlers?: boolean;
  horns?: boolean;
  tail?: 'bushy' | 'short' | 'flat' | 'none';
  longLegs?: boolean;
  longNeck?: boolean;
  beak?: number;
}

export interface HandCard {
  cardId: string;
  placed: number;
}

export interface PlayerState {
  name: string;
  isBot: boolean;
  board: Board;
  hand: HandCard[];
  done: HandCard[];
}

export type Side = 'A' | 'B';

export interface TurnState {
  takenSlot: number | null;
  pending: Color[];
  tookCard: boolean;
}

export interface ScoreBreakdown {
  trees: number;
  mountains: number;
  fields: number;
  buildings: number;
  water: number;
  animals: number;
  total: number;
}
