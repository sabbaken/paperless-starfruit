import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import {
  reviewApproveSchema,
  reviewBulkApproveSchema,
  reviewStatusSchema,
  type ReviewApprove,
  type ReviewBulkApprove,
  type ReviewDetail,
  type ReviewItemView,
  type ReviewStatus,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReviewService, type BulkResult } from './review.service';

const approvePipe = new ZodValidationPipe(reviewApproveSchema);
const bulkPipe = new ZodValidationPipe(reviewBulkApproveSchema);

@Controller('review')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  list(@Query('status') status?: string): ReviewItemView[] {
    const parsed = reviewStatusSchema.safeParse(status);
    return this.review.list(parsed.success ? (parsed.data as ReviewStatus) : undefined);
  }

  @Post('bulk-approve')
  @HttpCode(200)
  bulkApprove(@Body(bulkPipe) body: ReviewBulkApprove): Promise<BulkResult[]> {
    return this.review.bulkApprove(body.ids);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<ReviewDetail> {
    return this.review.get(id);
  }

  @Post(':id/approve')
  @HttpCode(204)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body(approvePipe) payload: ReviewApprove,
  ): Promise<void> {
    return this.review.approve(id, payload);
  }

  @Post(':id/reject')
  @HttpCode(204)
  reject(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.review.reject(id);
  }
}
