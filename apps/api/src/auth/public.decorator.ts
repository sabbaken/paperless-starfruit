import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route as exempt from the global auth guard. */
export const IS_PUBLIC = 'isPublic';

/** Marks a controller or handler as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
