export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    list: (filters?: Record<string, any>) => ['customers', 'list', filters] as const,
    detail: (id: number) => ['customers', 'detail', id] as const,
  },
  pool: {
    all: ['pool'] as const,
    list: (filters?: Record<string, any>) => ['pool', 'list', filters] as const,
    history: (id: number) => ['pool', 'history', id] as const,
  },
  templates: {
    all: ['templates'] as const,
    list: () => ['templates', 'list'] as const,
    detail: (id: number) => ['templates', 'detail', id] as const,
  },
  fields: {
    all: ['fields'] as const,
    list: () => ['fields', 'list'] as const,
  },
  regions: {
    all: ['regions'] as const,
    list: () => ['regions', 'list'] as const,
  },
};
