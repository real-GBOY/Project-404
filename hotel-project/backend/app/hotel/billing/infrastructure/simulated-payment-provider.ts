import { Injectable } from "@nestjs/common";
import { createPrefixedId } from "@core/kernel/id.js";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "../domain/payment-provider.js";

/**
 * v1 provider: every payment settles immediately, as it would at the desk (cash, a card terminal,
 * a confirmed bank transfer). It still goes through the full provider flow — pending row, call,
 * resolution — so swapping in a real gateway changes nothing upstream. It is the only place
 * "success" is decided; the frontend can never mark a payment paid.
 */
@Injectable()
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    return {
      status: "completed",
      providerReference: createPrefixedId(`sim_${request.method}`),
      failureReason: null,
    };
  }
}
