import { Module } from "@nestjs/common";
import { SearchController } from "./api/search.controller.js";
import { SearchRepository } from "./infrastructure/search-repository.js";

@Module({
  controllers: [SearchController],
  providers: [SearchRepository],
})
export class SearchModule {}
