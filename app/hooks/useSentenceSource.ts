// Hook to load sentences from JSON shards
export function useSentenceSource(level) {
  return { buffer: [], prefetching: false, setLevel: () => {}, getNextSentence: () => null };
}
