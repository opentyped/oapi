interface Cash {
  kind: 'cash';
}
interface Card {
  kind: 'card';
  last4: string;
}

/** @schema */
export type Payment = Cash | Card;
