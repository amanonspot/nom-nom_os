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

// Catalog
export type Category = Schemas['Category'];
export type CategoryWithItems = Schemas['CategoryWithItems'];
export type MenuItem = Schemas['MenuItem'];
export type VariationGroup = Schemas['VariationGroup'];
export type VariationOption = Schemas['VariationOption'];
export type AddOn = Schemas['AddOn'];

// Operations
export type Table = Schemas['Table'];
export type Customer = Schemas['Customer'];
export type Order = Schemas['Order'];
export type OrderItemRead = Schemas['OrderItemRead'];
export type Payment = Schemas['Payment'];
