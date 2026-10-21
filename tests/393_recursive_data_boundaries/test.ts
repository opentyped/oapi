/** @schema */
export interface Node {
  id: string;
  allOf?: Node;
  not?: Node | null;
  children?: Node[];
  dictionary?: { [key: string]: Node };
}
