/**
 * Shared API types generated from the DRF OpenAPI schema.
 *
 * Regenerate after backend model/serializer changes:
 *   cd backend && python manage.py spectacular --file ../packages/types/schema.yaml
 *   pnpm --filter @nomnom/types gen:types
 */
export type { paths, components, operations } from './schema';

import type { components } from './schema';

export type Schemas = components['schemas'];
export type Me = Schemas['Me'];
