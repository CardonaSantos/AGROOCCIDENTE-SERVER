import { Test, TestingModule } from '@nestjs/testing';
import { CuotasMoraCronService } from './cuotas-mora-cron.service';

describe('CuotasMoraCronService', () => {
  let service: CuotasMoraCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CuotasMoraCronService],
    }).compile();

    service = module.get<CuotasMoraCronService>(CuotasMoraCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
