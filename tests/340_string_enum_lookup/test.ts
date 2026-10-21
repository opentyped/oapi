enum Method {
  Alpha = 'alpha',
  Beta = 'beta',
}
/** @schema */
export interface Dataset {
  original: Method;
  first: Method[0];
  all: Method[number];
  member: Method.Alpha[0];
  length: Method['length'];
  mixed: Method[0 | 'length'];
  union: ('alpha' | 'beta')[0];
}
