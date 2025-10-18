import { Test, TestingModule } from '@nestjs/testing';
import { AbonoCuotaController } from './abono-cuota.controller';
import { AbonoCuotaService } from './abono-cuota.service';

describe('AbonoCuotaController', () => {
  let controller: AbonoCuotaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbonoCuotaController],
      providers: [AbonoCuotaService],
    }).compile();

    controller = module.get<AbonoCuotaController>(AbonoCuotaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
