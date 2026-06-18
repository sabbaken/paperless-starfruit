import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';

@Module({
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
