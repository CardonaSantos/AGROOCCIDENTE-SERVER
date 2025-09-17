import { Test, TestingModule } from '@nestjs/testing';
import { StockPresentacionService } from './stock-presentacion.service';

describe('StockPresentacionService', () => {
  let service: StockPresentacionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockPresentacionService],
    }).compile();

    service = module.get<StockPresentacionService>(StockPresentacionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
