import { Test, TestingModule } from '@nestjs/testing';
import { AbonoCuotaService } from './abono-cuota.service';

describe('AbonoCuotaService', () => {
  let service: AbonoCuotaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbonoCuotaService],
    }).compile();

    service = module.get<AbonoCuotaService>(AbonoCuotaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
