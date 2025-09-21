type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | string;

export interface ResumenDiarioAdminResponse {
  fecha: string; // YYYY-MM-DD (TZ GT)
  sucursalId: number;

  // Saldos por canal
  caja: {
    inicio: number;
    ingresos: number; // totales del día (incluye transferencias)
    egresos: number; // totales del día (incluye transferencias)
    finalFisico: number; // inicio + ingresos - egresos
    // Operativa (excluyendo depósito de cierre)
    egresosSinCierre: number; // egresos - depositoCierre
    finalOperativo: number; // inicio + ingresos - egresosSinCierre
  };
  banco: {
    inicio: number;
    ingresos: number;
    egresos: number;
    final: number; // inicio + ingresos - egresos
  };

  // Ventas
  ventas: {
    total: number;
    cantidad: number;
    ticketPromedio: number;
    porMetodo: Record<MetodoPago, number>;
    efectivo: number;
    efectivoCobrosCredito: number;
  };

  // Egresos operativos
  egresos: {
    costosVenta: {
      total: number;
      caja: number;
      banco: number;
      pagoProveedor: { caja: number; banco: number };
    };
    gastosOperativos: {
      total: number;
      caja: number;
      banco: number;
    };
  };

  // Transferencias del día
  transferencias: {
    depositoCierre: {
      montoBanco: number; // deltaBanco > 0 con motivo 'DEPOSITO_CIERRE'
      montoCaja: number; // |deltaCaja| correspondiente
      cantidad: number;
      porCuenta: Array<{
        cuentaBancariaId: number;
        banco: string;
        alias: string | null;
        numeroMasked: string | null;
        monto: number;
        cantidad: number;
      }>;
    };
    bancoACaja: number; // si existiera en el día (deltaCaja>0 & deltaBanco<0 y clasif TRANSFERENCIA)

    validaciones: {
      cajaDisponibleAntesDeDepositar: number;
      excesoDeposito: number;
    };
  };

  // Comparativos/alertas
  comparativos: {
    netoCajaOperativo: number; // ingresosCaja - egresosSinCierre
    efectivoVentas: number; // desde métodos de pago
    variacionCajaVsVentasEfectivo: number;

    ingresosCajaPorVentas: number;
    ingresosCajaPorVentasEstimado: boolean; // true si usamos fallback
    deltaVentasCajaVsEfectivo: number;
    ventasOk: boolean;
    cajaDisponibleAntesDeDepositar: number;
    depositoCierreCaja: number;
    excesoDeposito: number;
    depositoOk: boolean;
    alertas: string[];
  };

  // Diagnóstico
  diagnostico: {
    snapshotPrevio: { caja: number | null; banco: number | null };
    aperturaCaja: number | null; // saldoInicial de registroCaja
    chequeos: {
      identidadCajaOk: boolean;
      identidadBancoOk: boolean;
    };
  };
}
