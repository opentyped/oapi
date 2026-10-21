/** @schema */
export interface Model {
  required: string | null;
  optional?: string;
  both?: string | null;
  literal: 'ready' | null;
}
