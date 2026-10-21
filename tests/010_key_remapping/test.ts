/** @schema */
export type Model = { [K in 'id' | 'label' as `get_${K}`]: { id: number; label: string }[K] };
