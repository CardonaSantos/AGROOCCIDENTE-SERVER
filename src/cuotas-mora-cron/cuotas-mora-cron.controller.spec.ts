import { Test, TestingModule } from '@nestjs/testing';
import { CuotasMoraCronController } from './cuotas-mora-cron.controller';
import { CuotasMoraCronService } from './cuotas-mora-cron.service';

describe('CuotasMoraCronController', () => {
  let controller: CuotasMoraCronController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CuotasMoraCronController],
      providers: [CuotasMoraCronService],
    }).compile();

    controller = module.get<CuotasMoraCronController>(CuotasMoraCronController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
