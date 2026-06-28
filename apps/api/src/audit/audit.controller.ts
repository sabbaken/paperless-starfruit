import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  auditQuerySchema,
  type AuditEntryDetail,
  type AuditList,
  type AuditQuery,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditService } from './audit.service';

const queryPipe = new ZodValidationPipe(auditQuerySchema);

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query(queryPipe) query: AuditQuery): AuditList {
    return this.audit.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): AuditEntryDetail {
    const entry = this.audit.get(id);
    if (!entry) throw new NotFoundException(`Audit entry ${id} not found`);
    return entry;
  }
}
