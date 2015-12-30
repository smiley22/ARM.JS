module ARM.Simulator {
    /**
     * Simulates a UART modeled after the TI TL16C750C.
     */
    export class TL16C750 extends Device {
        private service: IVmService;
        private region: Region;
        private interrupt: (rxdInt: boolean) => void;

        /**
         * Initializes a new instance of the TL16C750C class.
         *
         * @param args
         */
        constructor(args: { interrupt: (rxdInt: boolean) => void }) {
            super();
            this.interrupt = args.interrupt;
        }

        OnRegister(baseAddress:number, service: IVmService): boolean {
            this.service = service;
            this.region = new Region(baseAddress, 0x10000,
                (a, t) => { return this.Read(a, t); },
                (a, t, v) => { this.Write(a, t, v); });
            if (!service.Map(this.region))
                return false;
            return true;

        }

        OnUnregister() {
        }

        Read(address: number, type: DataType): number {
            return 123;
        }

        Write(address: number, type: DataType, value: number): void {
        }

    }
}