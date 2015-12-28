module ARM.Simulator {
    /**
     * Simulates a UART modeled after the TI TL16C550C.
     */
    export class TL16C750 extends Device {
        constructor(args: { interrupt: (rxdInt: boolean) => void }) {
            super();
        }
        OnRegister(bla: number): boolean {
            return true;
        }

        OnUnregister() {
        }

    }
}