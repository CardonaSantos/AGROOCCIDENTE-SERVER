import { Test, TestingModule } from '@nestjs/testing';
import { StockPresentacionController } from './stock-presentacion.controller';
import { StockPresentacionService } from './stock-presentacion.service';

describe('StockPresentacionController', () => {
  let controller: StockPresentacionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockPresentacionController],
      providers: [StockPresentacionService],
    }).compile();

    controller = module.get<StockPresentacionController>(StockPresentacionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
