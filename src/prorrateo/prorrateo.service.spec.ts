import { Test, TestingModule } from '@nestjs/testing';
import { ProrrateoService } from './prorrateo.service';

describe('ProrrateoService', () => {
  let service: ProrrateoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProrrateoService],
    }).compile();

    service = module.get<ProrrateoService>(ProrrateoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
