import { Test, TestingModule } from '@nestjs/testing';
import { ProrrateoController } from './prorrateo.controller';
import { ProrrateoService } from './prorrateo.service';

describe('ProrrateoController', () => {
  let controller: ProrrateoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProrrateoController],
      providers: [ProrrateoService],
    }).compile();

    controller = module.get<ProrrateoController>(ProrrateoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
